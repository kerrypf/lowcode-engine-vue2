//@ts-nocheck
/* eslint-disable */
import { h } from '@formily/vue';
import {
  type Ref,
  type VNode,
  type Component,
  type ComponentPublicInstance,
  ref,
  computed,
} from 'vue';
import { shallowRef, type InjectionKey, inject, provide, watch, toRaw } from 'vue';
import {
  CurrentNode,
  INode,
  getCurrentNodeKey,
  useRendererContext,
} from '@knxcloud/lowcode-hooks';
import type {
  IPublicTypeNodeData as NodeData,
  IPublicTypeSlotSchema as SlotSchema,
  IPublicTypeNodeSchema as NodeSchema,
  IPublicTypeJSFunction as JSFunction,
  IPublicTypeCompositeValue as CompositeValue,
} from '@alilc/lowcode-types';
import {
  camelCase,
  isNil,
  isString,
  isFunction,
  isJSExpression,
  isNodeSchema,
  isObject,
  isJSSlot,
  isJSFunction,
  isSlotSchema,
  fromPairs,
  isPromise,
  toString,
  createObjectSplitter,
  isArray,
  isI18nData,
} from '@knxcloud/lowcode-utils';
import {
  Fragment,
  mergeProps,
  toDisplayString,
  isVNode,
  createTextVNode,
  createCommentVNode,
} from '../utils/vue-runtime-core';
import {
  type RuntimeScope,
  type Slot,
  type Slots,
  type BlockScope,
  SchemaParser,
  ensureArray,
  warnOnce,
  getI18n,
  mergeScope,
  AccessTypes,
  addToScope,
} from '../utils';
import { type LeafProps, leafProps } from './base';
import { buildSchema, isFragment, splitLeafProps, type SlotSchemaMap } from './use';
import Hoc from './hoc';
const IS_LOCKED: InjectionKey<Ref<boolean>> = Symbol('IS_LOCKED');
const IS_ROOT_NODE: InjectionKey<boolean> = Symbol('IS_ROOT_NODE');
const keepParam = <T, R>(param: T, cb: (param: T) => R) => {
  return cb(param);
};
function useLocked(defaultValue: boolean) {
  const selfLocked = ref(defaultValue);
  const parentLocked = inject(IS_LOCKED, null);

  const locked = computed({
    get: () => parentLocked?.value || selfLocked.value,
    set: (val) => (selfLocked.value = val),
  });

  provide(IS_LOCKED, locked);

  return locked;
}
const currentNodeKey = getCurrentNodeKey();
export default class UseLeaf {
  renderContext = useRendererContext();
  getNode = this.renderContext.getNode;
  wrapLeafComp = this.renderContext.wrapLeafComp;
  designMode = this.renderContext.designMode;
  thisRequiredInJSE = this.renderContext.thisRequiredInJSE;
  isDesignMode = this.designMode === 'design';
  parser = new SchemaParser({
    thisRequired: this.thisRequiredInJSE,
  });
  node;
  locked;

  constructor(
    leafProps: LeafProps,
    onChildShowChange?: (schema: NodeSchema, show: boolean) => void = () => void 0,
  ) {
    this.node = leafProps.__schema.id ? this.getNode(leafProps.__schema.id) : null;
    // 仅在设计模式下生效
    this.locked = this.node ? useLocked(this.node.isLocked) : ref(false);
    provide(currentNodeKey, {
      mode: this.designMode,
      node: this.node,
      isDesignerEnv: this.isDesignMode,
    } as CurrentNode);
  }
  render = (
    schema: NodeData,
    scope: RuntimeScope,
    comp?: Component | typeof Fragment,
  ): VNode | VNode[] | null => {
    const { componentName, id, children } = schema;
    if (!comp) {
      comp = this.renderContext.components[componentName];
      if (!comp) {
        if (componentName === 'Slot') {
          return ensureArray(children)
            .flatMap((item) => this.render(item, scope))
            .filter((item): item is VNode => !isNil(item));
        }

        if (this.isDesignMode) {
          return h(
            'div',
            {},
            { default: () => [`component[${componentName}] not found`] },
          );
        }

        comp = {
          setup(props, { slots }) {
            warnOnce('组件未找到, 组件名：' + componentName);
            return h(
              'div',
              {
                class: 'lc-component-not-found',
                props,
              },
              slots,
            );
          },
        };
      }
    }
    const ref = (inst: ComponentPublicInstance) => {
      console.log(inst, 'inst');
      const compCtx = this.renderContext.triggerCompGetCtx(schema, inst);
      console.log(compCtx, 'inst:compCtx');
      return compCtx;
    };
    const node = id ? this.getNode(id) : null;
    const { props: rawProps, slots: rawSlots } = buildSchema(schema);
    const props = this.buildProps(rawProps, scope, node, null, { ref });
    const [vnodeProps, compProps] = splitProps(props);
    return h(
      Hoc,
      {
        key: vnodeProps.key ?? id,
        attrs: {
          ...compProps,
        },
        props: {
          __comp: comp,
          __scope: scope,
          __schema: schema,
          __vnodeProps: vnodeProps,
        },
      },
      this.buildSlots(rawSlots, scope, node),
    );
  };
  buildSlots = (
    slots: SlotSchemaMap,
    scope: RuntimeScope,
    node?: INode | null,
  ): Slots => {
    return Object.keys(slots).reduce(
      (prev, next) => {
        let slotSchema = slots[next];
        const isDefaultSlot = next === 'default';

        // 插槽数据为 null 或 undefined 时不渲染插槽
        if (isNil(slotSchema) && !isDefaultSlot) return prev;

        // 默认插槽内容为空，且当前节点不是容器节点时，不渲染默认插槽
        if (
          isDefaultSlot &&
          !node?.isContainerNode &&
          ((isArray(slotSchema) && slotSchema.length === 0) || isNil(slotSchema))
        )
          return prev;

        let renderSlot: Slot;

        if (isArray(slotSchema) && slotSchema.length === 0) {
          slotSchema = slotSchema[0];
        }
        if (isArray(slotSchema)) {
          // 插槽为数组，则当前插槽不可拖拽编辑，直接渲染插槽内容
          renderSlot = keepParam(slotSchema, (schema) => () => {
            return schema
              .map((item) => this.render(item, scope))
              .filter((vnode): vnode is VNode => !isNil(vnode));
          });
        } else if (isSlotSchema(slotSchema)) {
          renderSlot = keepParam(slotSchema, (schema) => (...args: unknown[]) => {
            const vnode = this.render(
              schema,
              mergeScope(scope, this.parser.parseSlotScope(args, schema.params ?? [])),
            );
            return ensureArray(vnode);
          });
        } else {
          renderSlot = keepParam(
            slotSchema as NodeData,
            (schema) => () => ensureArray(this.render(schema, scope)),
          );
        }
        prev[next] =
          isDefaultSlot && node?.isContainerNode
            ? decorateDefaultSlot(renderSlot, this.locked) // 当节点为容器节点，且为设计模式下，则装饰默认插槽
            : renderSlot;

        return prev;
      },
      {} as Record<string, Slot>,
    );
  };
  buildProps = (
    propsSchema: Record<string, unknown>,
    scope: RuntimeScope,
    node?: INode | null,
    blockScope?: BlockScope | null,
    extraProps?: Record<string, unknown>,
  ): any => {
    // 属性预处理
    const processed: Record<string, unknown> = {};
    Object.keys(propsSchema).forEach((propKey) => {
      processProp(processed, propKey, propsSchema[propKey]);
    });

    // 将属性 schema 转化成真实的属性值
    const parsedProps: Record<string, unknown> = {};
    const mergedScope = blockScope ? mergeScope(scope, blockScope) : scope;
    Object.keys(processed).forEach((propName) => {
      const schema = processed[propName];
      parsedProps[propName] =
        propName === 'ref'
          ? this.buildRefProp(schema, mergedScope, blockScope, propName, node)
          : this.buildNormalProp(schema, mergedScope, blockScope, propName, node);
    });

    // 应用运行时附加的属性值
    if (extraProps) {
      Object.keys(extraProps).forEach((propKey) => {
        processProp(parsedProps, propKey, extraProps[propKey]);
      });
    }

    return parsedProps;
  };
  buildRefProp = (
    schema: unknown,
    scope: RuntimeScope,
    blockScope?: BlockScope | null,
    path?: string | null,
    node?: INode | null,
  ): any => {
    if (isString(schema)) {
      const field = schema;
      let lastInst: unknown = null;
      return (inst: unknown): void => {
        let refs = scope.$.refs;
        if (Object.keys(refs).length === 0) {
          refs = scope.$.refs = {};
        }
        if (isNil(scope.__loopRefIndex)) {
          refs[field] = inst;
          if (field in scope) {
            scope[field] = inst;
          }
        } else {
          let target = refs[field] as unknown[];
          if (!isArray(target)) {
            target = refs[field] = [];
            if (field in scope) {
              target = scope[field] = target;
            }
          } else if (field in scope) {
            const scopeTarget = scope[field];
            if (!isArray(scopeTarget) || toRaw(scopeTarget) !== target) {
              target = scope[field] = target;
            } else {
              target = scopeTarget;
            }
          }
          if (isNil(inst)) {
            const idx = target.indexOf(lastInst);
            idx >= 0 && target.splice(idx, 1);
          } else {
            target[scope.__loopRefIndex] = inst;
          }
        }
        lastInst = inst;
      };
    } else {
      const propValue = buildNormalProp(schema, scope, blockScope, path, node);
      return isString(propValue)
        ? buildRefProp(propValue, scope, blockScope, path, node)
        : propValue;
    }
  };
  buildNormalProp = (
    schema: unknown,
    scope: RuntimeScope,
    blockScope?: BlockScope | null,
    path?: string | null,
    node?: INode | null,
  ): any => {
    const prop = path ? node?.getProp(path, false) : null;
    if (isJSExpression(schema) || isJSFunction(schema)) {
      // 处理表达式和函数
      return parser.parseExpression(schema, scope);
    } else if (isI18nData(schema)) {
      return parser.parseI18n(schema, scope);
    } else if (isJSSlot(schema)) {
      // 处理属性插槽
      let slotParams: string[];
      let slotSchema: NodeData[] | NodeSchema | SlotSchema;
      if (prop?.slotNode) {
        // design 模式，从 prop 中导出 schema
        slotSchema = prop.slotNode.schema;
        slotParams = isSlotSchema(slotSchema) ? slotSchema.params ?? [] : [];
      } else {
        // live 模式，直接获取 schema 值
        slotSchema = ensureArray(schema.value);
        slotParams = schema.params ?? [];
      }

      // 返回 slot 函数
      return (...args: unknown[]) => {
        const slotScope = parser.parseSlotScope(args, slotParams);
        const vnodes: VNode[] = [];
        ensureArray(slotSchema).forEach((item) => {
          const vnode = renderComp(item, mergeScope(scope, blockScope, slotScope));
          ensureArray(vnode).forEach((item) => vnodes.push(item));
        });
        return vnodes;
      };
    } else if (isArray(schema)) {
      // 属性值为 array，递归处理属性的每一项
      return schema.map((item, idx) =>
        buildNormalProp(item, scope, blockScope, `${path}.${idx}`, node),
      );
    } else if (schema && isObject(schema)) {
      // 属性值为 object，递归处理属性的每一项
      const res: Record<string, unknown> = {};
      Object.keys(schema).forEach((key) => {
        if (key.startsWith('__')) return;
        const val = schema[key];
        res[key] = buildNormalProp(val, scope, blockScope, `${path}.${key}`, node);
      });
      return res;
    }
    return schema;
  };
}
const decorateDefaultSlot = (slot: Slot, locked: Ref<boolean>): Slot => {
  return (...args: unknown[]) => {
    const vnodes = slot(...args).filter(Boolean);
    if (!vnodes.length) {
      const isLocked = locked.value;
      const className = {
        'lc-container-locked': isLocked,
        'lc-container-placeholder': true,
      };
      const placeholder = isLocked ? '锁定元素及子元素无法编辑' : '拖拽组件或模板到这里';
      vnodes.push(h('div', { class: className }, { default: () => [placeholder] }));
    }
    return vnodes;
  };
};
const processProp = (target: Record<string, unknown>, key: string, val: unknown) => {
  if (key.startsWith('v-model')) {
    // 双向绑定逻辑
    const matched = key.match(/v-model(?::(\w+))?$/);
    if (!matched) return target;

    const valueProp = camelCase(matched[1] ?? 'modelValue');
    const eventProp = `onUpdate:${valueProp}`;

    // 若值为表达式，则自定注册 onUpdate 事件，实现双向绑定
    if (isJSExpression(val)) {
      const updateEventFn: JSFunction = {
        type: 'JSFunction',
        value: `function ($event) {${val.value} = $event}`,
      };
      target[eventProp] =
        eventProp in target
          ? ensureArray(target[eventProp]).concat(updateEventFn)
          : updateEventFn;
    }
    target[valueProp] = val;
  } else if (key.startsWith('v-')) {
    // TODO: 指令绑定逻辑
  } else if (key.match(/^on[A-Z]/)) {
    // 事件绑定逻辑

    // normalize: onUpdateXxx => onUpdate:xxx
    const matched = key.match(/onUpdate(?::?(\w+))$/);
    if (matched) {
      key = `onUpdate:${camelCase(matched[1])}`;
    }

    // 若事件名称重复，则自动转化为数组
    target[key] = key in target ? ensureArray(target[key]).concat(val) : val;
  } else if (key === 'ref' && 'ref' in target) {
    // ref 合并逻辑
    const sourceRef = val;
    const targetRef = target.ref;
    if (isFunction(targetRef) && isFunction(sourceRef)) {
      target.ref = (...args: unknown[]) => {
        sourceRef(...args);
        targetRef(...args);
      };
    } else {
      target.ref = [targetRef, sourceRef].filter(isFunction).pop();
    }
  } else {
    target[key] = val;
  }
};
export const splitProps = createObjectSplitter(
  'key,ref,ref_for,ref_key,' +
    'onVnodeBeforeMount,onVnodeMounted,' +
    'onVnodeBeforeUpdate,onVnodeUpdated,' +
    'onVnodeBeforeUnmount,onVnodeUnmounted',
);
