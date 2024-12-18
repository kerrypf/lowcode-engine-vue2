import { Suspense, Teleport, Comment, withCtx } from 'vue';
import Vue, { VNode, defineComponent } from 'vue';
import { merge as mergeProps } from '@formily/shared';
import {
  isPlainObject,
  isString,
  isArray,
  isObject,
  isFunction,
} from '@knxcloud/lowcode-utils';
import Fragment from 'vue-frag';

const isRef = Vue.isRef;

export const objectToString: typeof Object.prototype.toString = Object.prototype.toString;
export const toTypeString = (value: unknown): string => objectToString.call(value);
export const isMap = (val: unknown): val is Map<any, any> =>
  toTypeString(val) === '[object Map]';
export const isSet = (val: unknown): val is Set<any> =>
  toTypeString(val) === '[object Set]';
export const isSymbol = (val: unknown): val is symbol => typeof val === 'symbol';
// function cached<R>(fn: (str: string) => R): (sr: string) => R {
//   const cache: Record<string, R> = Object.create(null);
//   return function cachedFn(str: string) {
//     const hit = cache[str];
//     return hit || (cache[str] = fn(str));
//   };
// }
// const camelizeRE = /-(\w)/g;
// const camelize = cached((str: string): string => {
//   return str.replace(camelizeRE, (_, c) => (c ? c.toUpperCase() : ''));
// });
// function mergeProps(to, from) {
//   for (const key in from) {
//     to[camelize(key)] = from[key];
//   }
// }

function isVNode(val: any): val is VNode {
  return val && isPlainObject(val) && Object.hasOwn(val, 'componentOptions');
}

const createTextVNode = (text) =>
  defineComponent({
    render: (createElement) => {
      const vNode = createElement();
      vNode.text = text;
      vNode.isComment = false;
      return vNode;
    },
  });
const createCommentVNode = (text) =>
  defineComponent({
    render: (createElement) => {
      const vNode = createElement();
      vNode.text = text;
      vNode.isComment = true;
      return vNode;
    },
  });

const stringifySymbol = (v: unknown, i: number | string = ''): any =>
  // Symbol.description in es2019+ so we need to cast here to pass
  // the lib: es2016 check
  isSymbol(v) ? `Symbol(${(v as any).description ?? i})` : v;
const replacer = (_key: string, val: unknown): any => {
  if (isRef(val)) {
    return replacer(_key, val.value);
  } else if (isMap(val)) {
    return {
      [`Map(${val.size})`]: [...val.entries()].reduce(
        (entries, [key, val], i) => {
          entries[stringifySymbol(key, i) + ' =>'] = val;
          return entries;
        },
        {} as Record<string, any>,
      ),
    };
  } else if (isSet(val)) {
    return {
      [`Set(${val.size})`]: [...val.values()].map((v) => stringifySymbol(v)),
    };
  } else if (isSymbol(val)) {
    return stringifySymbol(val);
  } else if (isObject(val) && !isArray(val) && !isPlainObject(val)) {
    // native elements
    return String(val);
  }
  return val;
};
const toDisplayString = (val: unknown): string => {
  return isString(val)
    ? val
    : val == null
    ? ''
    : isArray(val) ||
      (isObject(val) && (val.toString === objectToString || !isFunction(val.toString)))
    ? isRef(val)
      ? toDisplayString(val.value)
      : JSON.stringify(val, replacer, 2)
    : String(val);
};

// const Comment: unique symbol = Symbol.for('v-cmt')
// const createCommentVNode = (text) => h(Comment, null, text)

// const objectToString: typeof Object.prototype.toString = Object.prototype.toString;
// const toTypeString = (value: unknown): string => objectToString.call(value);
// const isMap = (val: unknown): val is Map<any, any> =>
//   toTypeString(val) === '[object Map]';
// export const isSet = (val: unknown): val is Set<any> =>
//   toTypeString(val) === '[object Set]';
// const isSymbol = (val: unknown): val is symbol => typeof val === 'symbol';
// const stringifySymbol = (v: unknown, i: number | string = ''): any =>
//   // Symbol.description in es2019+ so we need to cast here to pass
//   // the lib: es2016 check
//   isSymbol(v) ? `Symbol(${(v as any).description ?? i})` : v
// const toDisplayString = (val: unknown): string => {
//   return isString(val)
//     ? val
//     : val == null
//       ? ''
//       : isArray(val) ||
//           (isObject(val) &&
//             (val.toString === objectToString || !isFunction(val.toString)))
//         ? isRef(val)
//           ? toDisplayString(val.value)
//           : JSON.stringify(val, replacer, 2)
//         : String(val)
// }
// const replacer = (_key: string, val: unknown): any => {
//   if (isRef(val)) {
//     return replacer(_key, val.value)
//   } else if (isMap(val)) {
//     return {
//       [`Map(${val.size})`]: [...val.entries()].reduce(
//         (entries, [key, val], i) => {
//           entries[stringifySymbol(key, i) + ' =>'] = val
//           return entries
//         },
//         {} as Record<string, any>,
//       ),
//     }
//   } else if (isSet(val)) {
//     return {
//       [`Set(${val.size})`]: [...val.values()].map(v => stringifySymbol(v)),
//     }
//   } else if (isSymbol(val)) {
//     return stringifySymbol(val)
//   } else if (isObject(val) && !isArray(val) && !isPlainObject(val)) {
//     // native elements
//     return String(val)
//   }
//   return val
// }

export {
  Fragment,
  Suspense,
  Teleport,
  Comment,
  createCommentVNode,
  createTextVNode,
  toDisplayString,
  isVNode,
  mergeProps,
  withCtx,
};
