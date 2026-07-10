declare module "uuid" {
  export function v4(): string;
}

declare module "events" {
  export class EventEmitter {
    on(event: string | symbol, listener: (...args: unknown[]) => void): this;
    emit(event: string | symbol, ...args: unknown[]): boolean;
  }
  export default EventEmitter;
}
