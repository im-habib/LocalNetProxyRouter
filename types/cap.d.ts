declare module "cap" {
  export const PROTOCOL: { [key: string]: number };
  export interface Device {
    name: string;
    description: string;
    addresses: { addr: string; netmask: string; broadaddr?: string }[];
  }

  export class Cap {
    open(
      device: string,
      filter: string,
      bufSize: number,
      buffer: Buffer
    ): string;
    close(): void;
    setMinBytes?: (min: number) => void;
    on(
      event: "packet",
      callback: (nbytes: number, truncated: boolean) => void
    ): void;
    static deviceList(): Device[];
  }
  export default Cap;
}
