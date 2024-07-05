declare module "solc" {
  export function compile(input: string): string;
}

declare module "solc/wrapper" {
  export default function wrapper(soljson: any): any;
}
