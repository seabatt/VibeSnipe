// Minimal typed wrapper — upgrade to real API once credentials active
export interface TTSession { token: string; accountId: string; }

export async function loginTastytrade(user: string, pass: string): Promise<TTSession> {
  console.info("Mock login:", user);
  return { token: "demo-token", accountId: "DEMO-123" };
}

export async function placeOrder(session: TTSession, payload: unknown) {
  console.log("placeOrder", payload);
  return { id: "ORDER-" + Math.random().toString(36).slice(2), state: "WORKING" };
}

export async function getPositions(session: TTSession) {
  return [];
}
