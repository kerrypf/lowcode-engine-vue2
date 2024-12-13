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
  console.log(parentNode, 'parentNode');

  const debouncedRerender = debounce(rerenderSlots);
  console.log(debouncedRerender, 'debouncedRerender');

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
    const comp = toRaw(props.__comp);
    const scope = toRaw(props.__scope);
    const vnodeProps = { ...props.__vnodeProps };
    const compProps = splitLeafProps(attrs)[1];
    const builtSlots = slotSchema.value
      ? buildSlots(slotSchema.value, scope, node)
      : slots;
    // const hocProps = mergeProps(compProps, vnodeProps);
    return () => h(comp, { ...vnodeProps, props: compProps }, builtSlots);
  },
});
