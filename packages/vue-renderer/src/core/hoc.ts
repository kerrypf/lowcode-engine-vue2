//@ts-nocheck
/* eslint-disable */
import { h } from '@formily/vue';

import {
  onUnmounted,
  defineComponent,
  shallowRef,
  toRaw,
  provide,
  inject,
  InjectionKey,
  watch,
} from 'vue';
import UseLeaf from './useLeaf';
import { buildSchema, isFragment, splitLeafProps, type SlotSchemaMap } from './use';
import { leafProps } from './base';
import { useRendererContext } from '@knxcloud/lowcode-hooks';
import type { IPublicTypeNodeSchema } from '@alilc/lowcode-types';
import { debounce, exportSchema, isJSSlot } from '@knxcloud/lowcode-utils';

const HOC_NODE_KEY: InjectionKey<{ rerenderSlots: () => void }> = Symbol('hocNode');
const useHocNode = (rerenderSlots: () => void) => {
  const { rerender } = useRendererContext();
  const parentNode = inject(HOC_NODE_KEY, null);

  const debouncedRerender = debounce(rerenderSlots);

  provide(HOC_NODE_KEY, {
    rerenderSlots: debouncedRerender,
  });

  if (!parentNode) {
    return {
      rerender: debouncedRerender,
      rerenderRoot: rerender,
      rerenderParent: rerender,
    };
  } else {
    return {
      rerender: debouncedRerender,
      rerenderRoot: rerender,
      rerenderParent: parentNode.rerenderSlots,
    };
  }
};
export default defineComponent({
  name: 'Hoc',
  inheritAttrs: false,
  props: leafProps,
  setup(props, { slots, attrs }) {
    // return;
    const showNode = shallowRef(true);
    const nodeSchema = shallowRef(props.__schema);
    const slotSchema = shallowRef<SlotSchemaMap>();

    const updateSchema = (newSchema: IPublicTypeNodeSchema) => {
      nodeSchema.value = newSchema;
      slotSchema.value = buildSchema(newSchema, node).slots;
    };

    const { rerender, rerenderRoot, rerenderParent } = useHocNode(() => {
      const newSchema = node ? exportSchema(node) : null;
      newSchema && updateSchema(newSchema);
    });

    const listenRecord: Record<string, () => void> = {};
    onUnmounted(() =>
      Object.keys(listenRecord).forEach((k) => {
        listenRecord[k]();
        delete listenRecord[k];
      }),
    );

    const { locked, node, buildSlots, getNode, isRootNode } = new UseLeaf(
      props,
      (schema, show) => {
        const id = schema.id;
        if (id) {
          if (show && listenRecord[id]) {
            listenRecord[id]();
            delete listenRecord[id];
          } else if (!show && !listenRecord[id]) {
            const childNode = getNode(id);
            if (childNode) {
              const cancelVisibleChange = childNode.onVisibleChange(() => rerender());
              const cancelPropsChange = childNode.onPropChange(() => rerender());
              listenRecord[id] = () => {
                cancelVisibleChange();
                cancelPropsChange();
              };
            }
          }
        }
      },
    );
    if (node) {
      const cancel = node.onChildrenChange(() => {
        // 默认插槽内容变更，无法确定变更的层级，所以只能全部更新
        rerenderRoot();
      });
      cancel && onUnmounted(cancel);
      onUnmounted(
        node.onPropChange((info) => {
          const { key, prop, newValue, oldValue } = info;
          const isRootProp = prop.path.length === 1;
          if (isRootProp) {
            if (key === '___isLocked___') {
              locked.value = newValue;
            } else if (isJSSlot(newValue) || isJSSlot(oldValue)) {
              // 插槽内容变更，无法确定变更的层级，所以只能全部更新
              rerenderRoot();
            } else {
              // 普通属性更新，通知父级重新渲染
              rerenderParent();
            }
          } else {
            // 普通属性更新，通知父级重新渲染
            rerenderParent();
          }
        }),
      );
      onUnmounted(
        node.onVisibleChange((visible: boolean) => {
          isRootNode
            ? // 当前节点为根节点（Page），直接隐藏
              (showNode.value = visible)
            : // 当前节点显示隐藏发生改变，通知父级组件重新渲染子组件
              rerenderParent();
        }),
      );
      updateSchema(exportSchema(node));
    }

    watch(
      () => props.__schema,
      (newSchema) => updateSchema(newSchema),
    );

    return () => {
      const comp = toRaw(props.__comp);
      const scope = toRaw(props.__scope);
      const vnodeProps = { ...props.__vnodeProps };
      const compProps = splitLeafProps(attrs)[1];
      const builtSlots = slotSchema.value
        ? buildSlots(slotSchema.value, scope, node)
        : slots;

      console.log(compProps, 'compProps');
      return comp
        ? isFragment(comp)
          ? h(Fragment, builtSlots.default?.())
          : h(
              comp,
              { ...vnodeProps, ...compProps, attrs: compProps, props: compProps },
              builtSlots,
            )
        : h('div', 'component not found');
    };
  },
});
