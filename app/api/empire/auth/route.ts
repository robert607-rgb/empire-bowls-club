import {
  apiError,
  authenticateEmpireAccess,
  authenticateEmpireMember,
  endEmpireSession,
  getEmpireAccess,
  hasEmpireAccess,
  rotateEmpireAccess,
  readJson,
  sameOrigin,
  sessionCookie,
  expiredSessionCookie,
} from "../_server";

export async function GET(request: Request) {
  try {
    const access = await getEmpireAccess(request);
    return Response.json({ access }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const input = await readJson(request);
    const access = input.access === "admin" ? "admin" : input.access === "member" ? "member" : null;
    if (!access)
      return Response.json({ error: "Please enter the correct access details." }, { status: 400 });
    if (access === "member") {
      const firstName = typeof input.firstName === "string" ? input.firstName.trim() : "";
      const code = typeof input.code === "string" ? input.code.trim() : "";
      if (!firstName || firstName.length > 120 || !/^\d{4}$/.test(code)) {
        return Response.json({ error: "Enter your first name and four-digit member code." }, { status: 400 });
      }
    } else {
      const password = typeof input.password === "string" ? input.password : "";
      if (!password || password.length > 256) {
        return Response.json({ error: "Please enter the correct admin password." }, { status: 400 });
      }
    }
    const result = access === "member"
      ? await authenticateEmpireMember(
          request,
          typeof input.firstName === "string" ? input.firstName.trim() : "",
          typeof input.code === "string" ? input.code.trim() : "",
        )
      : await authenticateEmpireAccess(
          request,
          access,
          typeof input.password === "string" ? input.password : "",
        );
    if (!result.ok) {
      return Response.json(
        { error: result.rateLimited ? "Too many attempts. Please wait 15 minutes and try again." : "That password does not match this area. Please try again." },
        { status: result.rateLimited ? 429 : 401 },
      );
    }
    return Response.json(
      { access },
      { headers: { "set-cookie": sessionCookie(result.token, result.expiresAt), "cache-control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    await endEmpireSession(request);
    return Response.json({ signedOut: true }, { headers: { "set-cookie": expiredSessionCookie, "cache-control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  if (!(await hasEmpireAccess(request, true)))
    return Response.json({ error: "This area requires administrator access." }, { status: 401 });
  if (!sameOrigin(request))
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const input = await readJson(request);
    const access = input.access === "admin" ? "admin" : null;
    const password = typeof input.password === "string" ? input.password.trim() : "";
    if (!access || password.length < 12 || password.length > 256)
      return Response.json({ error: "Use a new password of at least 12 characters." }, { status: 400 });
    await rotateEmpireAccess(access, password);
    return Response.json({ updated: true }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
