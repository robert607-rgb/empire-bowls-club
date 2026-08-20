import {
  apiError,
  cleanText,
  getEmpireDatabase,
  hasEmpireAccess,
  sameOrigin,
  unauthorized,
} from "../_server";

type MemberRow = {
  id: number;
  name: string;
  phone: string;
  email: string;
  membership_type: "Full member" | "Social member";
  created_at: string;
};

export async function GET(request: Request) {
  if (!(await hasEmpireAccess(request))) return unauthorized();
  try {
    const db = await getEmpireDatabase();
    const result = await db
      .prepare(
        "SELECT id, name, phone, email, membership_type, created_at FROM empire_members ORDER BY name COLLATE NOCASE ASC",
      )
      .all<MemberRow>();
    return Response.json({
      members: (result.results ?? []).map((member) => ({
        id: member.id,
        name: member.name,
        phone: member.phone,
        email: member.email,
        membershipType: member.membership_type,
        createdAt: member.created_at,
      })),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  if (!(await hasEmpireAccess(request, true))) return unauthorized();
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const input = (await request.json()) as Record<string, unknown>;
    const name = cleanText(input.name, 120),
      address = cleanText(input.address, 500),
      phone = cleanText(input.phone, 40),
      email = cleanText(input.email, 160);
    const membershipType =
      input.membershipType === "Social member"
        ? "Social member"
        : input.membershipType === "Full member"
          ? "Full member"
          : "";
    if (!name || !address || !phone || !email || !membershipType)
      return Response.json(
        { error: "Please complete every member detail." },
        { status: 400 },
      );
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return Response.json(
        { error: "Please enter a valid email address." },
        { status: 400 },
      );
    const db = await getEmpireDatabase();
    const createdAt = new Date().toISOString();
    const result = await db
      .prepare(
        "INSERT INTO empire_members (name, address, phone, email, membership_type, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(name, address, phone, email, membershipType, createdAt)
      .run();
    return Response.json(
      {
        member: {
          id: result.meta.last_row_id,
          name,
          phone,
          email,
          membershipType,
          createdAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  if (!(await hasEmpireAccess(request, true))) return unauthorized();
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const input = (await request.json()) as Record<string, unknown>;
    const id = Number(input.id);
    if (!Number.isInteger(id))
      return Response.json(
        { error: "Choose a valid member." },
        { status: 400 },
      );
    const db = await getEmpireDatabase();
    await db.prepare("DELETE FROM empire_members WHERE id = ?").bind(id).run();
    return Response.json({ removed: true });
  } catch (error) {
    return apiError(error);
  }
}
