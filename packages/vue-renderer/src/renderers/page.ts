import { defineComponent, ref } from 'vue';
import { h } from '@formily/vue';
import { isPromise } from '@knxcloud/lowcode-utils';
import { useRenderer, rendererProps, useRootScope } from '../core';

const Page = defineComponent((props, { slots }) => {
  console.log(props, slots, 'page-render');
  return () => h('div', { class: 'lc-page', style: { height: '100%' }, props }, slots);
});

export const PageRenderer = defineComponent({
  name: 'PageRenderer',
  props: rendererProps,
  __renderer__: true,
  setup(props, context) {
    const { scope, wrapRender } = useRootScope(props, context);
    console.log(props, 'PageRenderer-props');
    const { renderComp, componentsRef, schemaRef } = useRenderer(props, scope);
    const isReady = ref(false);
    const initDo = wrapRender();
    if (isPromise(initDo)) {
      initDo.then(() => (isReady.value = true));
    } else {
      isReady.value = true;
    }
    console.log(componentsRef, 'componentsRef');
    return () => {
      return (
        // isReady.value &&
        renderComp(schemaRef.value, scope, componentsRef.value.Page || Page)
      );
    };
  },
});
