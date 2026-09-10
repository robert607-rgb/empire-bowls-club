import {
  apiError,
  cleanText,
  getEmpireDatabase,
  hasEmpireAccess,
  readJson,
  sameOrigin,
  unauthorized,
} from "../_server";

type CommitteeRow = {
  id: number;
  role: string;
  name: string;
  phone: string;
  sort_order: number;
  created_at: string;
};

function mapCommitteeMember(member: CommitteeRow) {
  return {
    id: member.id,
    role: member.role,
    name: member.name,
    phone: member.phone,
    sortOrder: member.sort_order,
    createdAt: member.created_at,
  };
}

function readCommitteeMember(input: Record<string, unknown>) {
  return {
    role: cleanText(input.role, 160),
    name: cleanText(input.name, 120),
    phone: cleanText(input.phone, 40),
  };
}

function validateCommitteeMember(member: ReturnType<typeof readCommitteeMember>) {
  if (!member.role || !member.name || !member.phone) {
    return "Please enter the committee member's role, name and contact number.";
  }
  return "";
}

export async function GET() {
  try {
    const db = await getEmpireDatabase();
    const result = await db
      .prepare(
        "SELECT id, role, name, phone, sort_order, created_at FROM empire_committee ORDER BY sort_order ASC, id ASC",
      )
      .all<CommitteeRow>();
    return Response.json(
      { members: (result.results ?? []).map(mapCommitteeMember) },
      { headers: { "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400" } },
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  if (!(await hasEmpireAccess(request, true))) return unauthorized();
  if (!sameOrigin(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }
  try {
    const member = readCommitteeMember(await readJson(request));
    const validationError = validateCommitteeMember(member);
    if (validationError) return Response.json({ error: validationError }, { status: 400 });
    const db = await getEmpireDatabase();
    const nextOrder = await db
      .prepare("SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM empire_committee")
      .first<{ next_order: number }>();
    const createdAt = new Date().toISOString();
    const result = await db
      .prepare(
        "INSERT INTO empire_committee (role, name, phone, sort_order, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(member.role, member.name, member.phone, Number(nextOrder?.next_order ?? 1), createdAt)
      .run();
    return Response.json(
      {
        member: mapCommitteeMember({
          id: Number(result.meta.last_row_id),
          role: member.role,
          name: member.name,
          phone: member.phone,
          sort_order: Number(nextOrder?.next_order ?? 1),
          created_at: createdAt,
        }),
      },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  if (!(await hasEmpireAccess(request, true))) return unauthorized();
  if (!sameOrigin(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }
  try {
    const input = await readJson(request);
    const id = Number(input.id);
    if (!Number.isInteger(id)) {
      return Response.json({ error: "Choose a valid committee member." }, { status: 400 });
    }
    const member = readCommitteeMember(input);
    const validationError = validateCommitteeMember(member);
    if (validationError) return Response.json({ error: validationError }, { status: 400 });
    const db = await getEmpireDatabase();
    const current = await db
      .prepare("SELECT id, role, name, phone, sort_order, created_at FROM empire_committee WHERE id = ?")
      .bind(id)
      .first<CommitteeRow>();
    if (!current) {
      return Response.json({ error: "That committee member no longer exists." }, { status: 404 });
    }
    await db
      .prepare("UPDATE empire_committee SET role = ?, name = ?, phone = ? WHERE id = ?")
      .bind(member.role, member.name, member.phone, id)
      .run();
    return Response.json({
      member: mapCommitteeMember({ ...current, ...member }),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  if (!(await hasEmpireAccess(request, true))) return unauthorized();
  if (!sameOrigin(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }
  try {
    const input = await readJson(request);
    const id = Number(input.id);
    if (!Number.isInteger(id)) {
      return Response.json({ error: "Choose a valid committee member." }, { status: 400 });
    }
    const db = await getEmpireDatabase();
    const current = await db.prepare("SELECT id FROM empire_committee WHERE id = ?").bind(id).first<{ id: number }>();
    if (!current) {
      return Response.json({ error: "That committee member no longer exists." }, { status: 404 });
    }
    await db.prepare("DELETE FROM empire_committee WHERE id = ?").bind(id).run();
    return Response.json({ removed: true });
  } catch (error) {
    return apiError(error);
  }
}
