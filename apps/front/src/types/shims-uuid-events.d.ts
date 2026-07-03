declare module "uuid" {
  export function v4(): string;
}

declare module "events" {
  export class EventEmitter {
    on(event: string | symbol, listener: (...args: any[]) => void): this;
    emit(event: string | symbol, ...args: any[]): boolean;
  }
  export default EventEmitter;
}
