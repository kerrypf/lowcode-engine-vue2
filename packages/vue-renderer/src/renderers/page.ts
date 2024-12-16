//@ts-nocheck
/* eslint-disable */
import { defineComponent, computed, ref } from 'vue';
import { h } from '@formily/vue';
import { isPromise } from '@knxcloud/lowcode-utils';
import { useRenderer, rendererProps, useRootScope } from '../core';
import { type LeafProps } from '../core/base';

const Page = defineComponent((props, { slots }) => {
  return () => h('div', { class: 'lc-page', style: { height: '100%' }, props }, slots);
});

// export const PageRenderer1 = defineComponent({
//   name: 'PageRenderer',
//   props: rendererProps,
//   __renderer__: true,
//   setup(props, context) {
//     const { scope, wrapRender } = useRootScope(props, context);
//     const { renderComp, componentsRef, schemaRef } = useRenderer(props, scope);
//     const isReady = ref(false);
//     const initDo = wrapRender();
//     if (isPromise(initDo)) {
//       initDo.then((res) => {
//         isReady.value = res;
//       });
//     } else {
//       console.log(initDo, 'res1');
//       isReady.value = true;
//     }
//     // return () =>
//     //   isReady.value
//     //     ? renderComp(schemaRef.value, scope, componentsRef.value.Page || Page)
//     //     : null;
//     return () => {
//       return (
//         // isReady.value &&
//         renderComp(schemaRef.value, scope, componentsRef.value.Page || Page)
//       );
//     };
//   },
// });

import UseLeaf from '../core/useLeaf';
export const PageRenderer = defineComponent({
  name: 'PageRenderer',
  props: rendererProps,
  __renderer__: true,
  setup(props, context) {
    const { scope } = useRootScope(props, context);
    const schemaRef = computed(() => props.__schema);
    const leafProps: LeafProps = {
      __comp: null,
      __scope: scope,
      __isRootNode: true,
      __vnodeProps: {},
      __schema: props.__schema,
    };

    const designModeRef = computed(() => props.__designMode ?? 'live');
    const componentsRef = computed(() => props.__components);
    const { render } = new UseLeaf(leafProps);
    return () => render(schemaRef.value, scope, componentsRef.value.Page || Page);
  },
});
