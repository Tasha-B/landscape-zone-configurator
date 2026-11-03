// Test support: stands in for socket.io-client, so no test opens a connection.
//   vi.mock("socket.io-client", () => import("<path>/fakeSocket"));
// A socket does nothing by itself; the test drives it.

type Handler = (...args: never[]) => void;

export class FakeSocket {
  readonly url: string;
  readonly options: unknown;
  disconnected = false;
  private readonly handlers = new Map<string, Handler>();
  private readonly joins: { body: unknown; ack: (answer: { ok: boolean }) => void }[] = [];

  constructor(url: string, options: unknown) {
    this.url = url;
    this.options = options;
  }

  on(name: string, handler: Handler): void {
    this.handlers.set(name, handler);
  }

  emit(name: string, body: unknown, ack: (answer: { ok: boolean }) => void): void {
    if (name !== "join") throw new Error(`Unexpected emit: ${name}`);
    this.joins.push({ body, ack });
  }

  disconnect(): void {
    this.disconnected = true;
  }

  // What the server would do

  receive(name: string, ...args: unknown[]): void {
    (this.handlers.get(name) as ((...args: unknown[]) => void) | undefined)?.(...args);
  }

  get joinBodies(): unknown[] {
    return this.joins.map((join) => join.body);
  }

  answerJoin(ok = true): void {
    this.joins.at(-1)!.ack({ ok });
  }
}

export const sockets: FakeSocket[] = [];

export function io(url: string, options: unknown): FakeSocket {
  const socket = new FakeSocket(url, options);
  sockets.push(socket);
  return socket;
}
