import { ComponentInternalInstance } from 'vue';
export type Data = Record<string, unknown>;
export type Prop<T, D = T> = PropOptions<T, D> | PropType<T>;
type DefaultFactory<T> = (props: Data) => T | null | undefined;
interface PropOptions<T = any, D = T> {
  type?: PropType<T> | true | null;
  required?: boolean;
  default?: D | DefaultFactory<D> | null | undefined | object;
  validator?(value: unknown): boolean;
  /* removed internal: skipCheck */
  /* removed internal: skipFactory */
}
export type PropType<T> = PropConstructor<T> | PropConstructor<T>[];
type PropConstructor<T = any> =
  | {
      new (...args: any[]): T & {};
    }
  | {
      (): T;
    }
  | PropMethod<T>;
type PropMethod<T, TConstructor = any> = [T] extends [((...args: any) => any) | undefined]
  ? {
      new (): TConstructor;
      (): T;
      readonly prototype: TConstructor;
    }
  : never;

export declare function withCtx(
  fn: () => void,
  ctx?: ComponentInternalInstance | null,
  isNonScopedSlot?: boolean,
): () => void;
