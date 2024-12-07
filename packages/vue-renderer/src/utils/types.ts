import type { ExtractDefaultPropTypes, ExtractPropTypes } from 'vue';
import { IfAny } from 'vue/types/common';
import { VNode } from './vue-runtime-core';
export type ExtractPublicPropTypes<T> = Omit<
  ExtractPropTypes<T>,
  keyof ExtractDefaultPropTypes<T>
> &
  Partial<ExtractDefaultPropTypes<T>>;

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

export type Slot<T extends any = any> = (
  ...args: IfAny<T, any[], [T] | (T extends undefined ? [] : never)>
) => VNode[];
type InternalSlots = {
  [name: string]: Slot | undefined;
};
export type Slots = Readonly<InternalSlots>;

type VNodeChildAtom = VNode | string | number | boolean | null | undefined | void;
export type VNodeArrayChildren = Array<VNodeArrayChildren | VNodeChildAtom>;
export type VNodeChild = VNodeChildAtom | VNodeArrayChildren;
