import { NextResponse } from "next/server";
import { route, parseBody, clientIp } from "@/server/http";
import { enforce, limiters } from "@/server/limits";
import { registerSchema } from "@/lib/validation/schemas";
import { registerUser } from "@/server/services/account.service";

export const POST = route(async (req) => {
  enforce(limiters.register, clientIp(req));
  const input = await parseBody(req, registerSchema);
  const user = await registerUser(input);
  return NextResponse.json({ user }, { status: 201 });
});
