import {
  apiError,
  cleanText,
  getEmpireAccess,
  getEmpireDatabase,
  hasEmpireAccess,
  readJson,
  sameOrigin,
  unauthorized,
} from "../_server";

type MemberRow = {
  id: number;
  name: string;
  date_of_birth: string | null;
  address: string;
  phone: string;
  email: string;
  membership_type: "Full member" | "Social member";
  created_at: string;
};

function mapMember(member: MemberRow, includeAddress: boolean) {
  return {
    id: member.id,
    name: member.name,
    ...(includeAddress
      ? {
          address: member.address,
          dateOfBirth: member.date_of_birth ?? "",
        }
      : {}),
    phone: member.phone,
    email: member.email,
    membershipType: member.membership_type,
    createdAt: member.created_at,
  };
}

function readMember(input: Record<string, unknown>) {
  const name = cleanText(input.name, 120);
  const dateOfBirth = cleanText(input.dateOfBirth, 10);
  const address = cleanText(input.address, 500);
  const phone = cleanText(input.phone, 40);
  const email = cleanText(input.email, 160);
  const membershipType =
    input.membershipType === "Social member"
      ? "Social member"
      : input.membershipType === "Full member"
        ? "Full member"
        : "";
  return { name, dateOfBirth, address, phone, email, membershipType };
}

function isValidDateOfBirth(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value &&
    value <= new Date().toISOString().slice(0, 10)
  );
}

function validateMember(
  member: ReturnType<typeof readMember>,
  requireDateOfBirth = false,
) {
  if (
    !member.name ||
    !member.address ||
    !member.phone ||
    !member.email ||
    !member.membershipType
  ) {
    return "Please complete every member detail.";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(member.email)) {
    return "Please enter a valid email address.";
  }
  if ((requireDateOfBirth && !member.dateOfBirth) || (member.dateOfBirth && !isValidDateOfBirth(member.dateOfBirth))) {
    return "Please enter a valid date of birth.";
  }
  return "";
}

export async function GET(request: Request) {
  const access = await getEmpireAccess(request);
  if (!access) return unauthorized();
  try {
    const db = await getEmpireDatabase();
    const result = await db
      .prepare(
        "SELECT id, name, date_of_birth, address, phone, email, membership_type, created_at FROM empire_members ORDER BY name COLLATE NOCASE ASC",
      )
      .all<MemberRow>();
    return Response.json(
      {
        members: (result.results ?? []).map((member) =>
          mapMember(member, access === "admin"),
        ),
      },
      { headers: { "cache-control": "no-store" } },
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
    const member = readMember(await readJson(request));
    const validationError = validateMember(member, true);
    if (validationError) {
      return Response.json({ error: validationError }, { status: 400 });
    }
    const db = await getEmpireDatabase();
    const createdAt = new Date().toISOString();
    const result = await db
      .prepare(
        "INSERT INTO empire_members (name, date_of_birth, address, phone, email, membership_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        member.name,
        member.dateOfBirth,
        member.address,
        member.phone,
        member.email,
        member.membershipType,
        createdAt,
      )
      .run();
    return Response.json(
      {
        member: mapMember(
          {
            id: Number(result.meta.last_row_id),
            name: member.name,
            date_of_birth: member.dateOfBirth,
            address: member.address,
            phone: member.phone,
            email: member.email,
            membership_type: member.membershipType as MemberRow["membership_type"],
            created_at: createdAt,
          },
          true,
        ),
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
      return Response.json({ error: "Choose a valid member." }, { status: 400 });
    }
    const member = readMember(input);
    const validationError = validateMember(member);
    if (validationError) {
      return Response.json({ error: validationError }, { status: 400 });
    }
    const db = await getEmpireDatabase();
    const current = await db
      .prepare("SELECT id, name, date_of_birth, address, phone, email, membership_type, created_at FROM empire_members WHERE id = ?")
      .bind(id)
      .first<MemberRow>();
    if (!current) {
      return Response.json({ error: "That member no longer exists." }, { status: 404 });
    }
    const dateOfBirth = member.dateOfBirth || current.date_of_birth || null;
    await db
      .prepare(
        "UPDATE empire_members SET name = ?, date_of_birth = ?, address = ?, phone = ?, email = ?, membership_type = ? WHERE id = ?",
      )
      .bind(
        member.name,
        dateOfBirth,
        member.address,
        member.phone,
        member.email,
        member.membershipType,
        id,
      )
      .run();
    return Response.json({
      member: mapMember(
        {
          ...current,
          name: member.name,
          date_of_birth: dateOfBirth,
          address: member.address,
          phone: member.phone,
          email: member.email,
          membership_type: member.membershipType as MemberRow["membership_type"],
        },
        true,
      ),
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
      return Response.json({ error: "Choose a valid member." }, { status: 400 });
    }
    const db = await getEmpireDatabase();
    await db.prepare("DELETE FROM empire_members WHERE id = ?").bind(id).run();
    return Response.json({ removed: true });
  } catch (error) {
    return apiError(error);
  }
}
