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
import { Live } from './leaf/live';
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
    console.log(schema, 'schema');
    if (isString(schema)) {
      console.log(schema, createTextVNode(schema), 'createTextVNode(schema)');
      return schema;
      // return createTextVNode(schema);
    } else if (isNil(schema)) {
      return null;
    } else if (!isNodeSchema(schema)) {
      const result = this.parser.parseSchema(schema, scope);
      return toDisplayString(result);
      // return createTextVNode(toDisplayString(result));
    }

    const { show, scene } = this.buildShow(schema, scope, this.isDesignMode);
    if (!show) {
      return createCommentVNode(`${scene} ${show}`);
    }

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
      this.renderContext.triggerCompGetCtx(schema, inst);
    };
    const node = id ? this.getNode(id) : null;
    const { props: rawProps, slots: rawSlots } = buildSchema(schema);
    const { loop, buildLoopScope } = this.buildLoop(schema, scope);
    if (!loop) {
      const props = this.buildProps(rawProps, scope, node, null, { ref });
      const [vnodeProps, compProps] = splitProps(props);
      console.log('comp1111 render', comp);
      return h(
        this.isDesignMode ? Hoc : Live,
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
    }

    if (!isArray(loop)) {
      console.warn('循环对象必须是数组, type: ' + toString(loop));
      return null;
    }

    return loop.map((item, index, arr) => {
      const blockScope = buildLoopScope(item, index, arr.length);
      const props = this.buildProps(rawProps, scope, node, blockScope, { ref });
      const [vnodeProps, compProps] = splitProps(props);
      const mergedScope = mergeScope(scope, blockScope);
      return h(
        Hoc,
        {
          key: vnodeProps.key ?? `${id}--${index}`,
          attrs: {
            ...compProps,
          },
          props: {
            __comp: comp,
            __scope: mergedScope,
            __schema: schema,
            __vnodeProps: vnodeProps,
          },
        },
        this.buildSlots(rawSlots, mergedScope, node),
      );
    });
  };
  buildSlots = (
    slots: SlotSchemaMap,
    scope: RuntimeScope,
    node?: INode | null,
  ): Slots => {
    return Object.keys(slots).reduce(
      (prev, next) => {
        let slotSchema = slots[next];
        console.log(slotSchema, 'slotSchema');
        const isDefaultSlot = next === 'default';

        // 插槽数据为 null 或 undefined 时不渲染插槽
        console.log(isNil(slotSchema), isDefaultSlot, 'slotSchema');
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
        console.log('renderSlot', renderSlot, isDefaultSlot, node?.isContainerNode);
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
        let refs = scope.$refs;
        if (Object.keys(refs).length === 0) {
          refs = scope.$refs = {};
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
      const propValue = this.buildNormalProp(schema, scope, blockScope, path, node);
      return isString(propValue)
        ? this.buildRefProp(propValue, scope, blockScope, path, node)
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
      return this.parser.parseExpression(schema, scope);
    } else if (isI18nData(schema)) {
      return this.parser.parseI18n(schema, scope);
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
        const slotScope = this.parser.parseSlotScope(args, slotParams);
        const vnodes: VNode[] = [];
        ensureArray(slotSchema).forEach((item) => {
          const vnode = this.render(item, mergeScope(scope, blockScope, slotScope));
          ensureArray(vnode).forEach((item) => vnodes.push(item));
        });
        return vnodes;
      };
    } else if (isArray(schema)) {
      // 属性值为 array，递归处理属性的每一项
      return schema.map((item, idx) =>
        this.buildNormalProp(item, scope, blockScope, `${path}.${idx}`, node),
      );
    } else if (schema && isObject(schema)) {
      // 属性值为 object，递归处理属性的每一项
      const res: Record<string, unknown> = {};
      Object.keys(schema).forEach((key) => {
        if (key.startsWith('__')) return;
        const val = schema[key];
        res[key] = this.buildNormalProp(val, scope, blockScope, `${path}.${key}`, node);
      });
      return res;
    }
    return schema;
  };
  buildLoop = (schema: NodeSchema, scope: RuntimeScope) => {
    let loop: CompositeValue | null = null;
    const loopArgs = ['item', 'index'];

    if (schema.loop) loop = schema.loop;
    if (schema.loopArgs) {
      schema.loopArgs.forEach((v, i) => {
        v != null && v !== '' && (loopArgs[i] = v);
      });
    }

    return {
      loop: loop ? this.parser.parseSchema(loop, scope) : null,
      loopArgs,
      buildLoopScope(item, index, len): BlockScope {
        const offset = scope.__loopRefOffset ?? 0;
        const [itemKey, indexKey] = loopArgs;
        return {
          [itemKey]: item,
          [indexKey]: index,
          __loopScope: true,
          __loopRefIndex: offset + index,
          __loopRefOffset: len * index,
        };
      },
    } as {
      loop: unknown;
      loopArgs: [string, string];
      buildLoopScope(item: unknown, index: number, len: number): BlockScope;
    };
  };
  buildShow = (schema: NodeSchema, scope: RuntimeScope, isDesignMode: boolean) => {
    const hidden = isDesignMode ? schema.hidden ?? false : false;
    const condition = schema.condition ?? true;

    if (hidden) return { scene: 'hidden', show: false };
    return {
      scene: 'condition',
      show:
        typeof condition === 'boolean'
          ? condition
          : !!this.parser.parseSchema(condition, scope),
    };
  };
}
const decorateDefaultSlot = (slot: Slot, locked: Ref<boolean>): Slot => {
  return (...args: unknown[]) => {
    const vnodes = slot(...args).filter(Boolean);
    console.log(vnodes, 'vnodes');
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
