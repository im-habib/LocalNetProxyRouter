declare module "pcap" {
  export function createSession(iface: string, options?: any): any;
  export const decode: {
    packet(raw: any): any;
  };
}
