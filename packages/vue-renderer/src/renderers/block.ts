//@ts-nocheck
import { useRendererContext } from '@knxcloud/lowcode-hooks';
import { defineComponent, getCurrentInstance, onMounted } from 'vue';
// import { Fragment } from 'vue-frag';
import { Fragment } from '../utils/vue-runtime-core';
import { useRenderer, rendererProps, useRootScope } from '../core';
import { isFragment } from '../core/use';

export const BlockRenderer = defineComponent({
  name: 'BlockRenderer',
  props: rendererProps,
  __renderer__: true,
  setup(props, context) {
    const { scope, wrapRender } = useRootScope(props, context);
    const { triggerCompGetCtx } = useRendererContext();
    const { renderComp, schemaRef, componentsRef } = useRenderer(props, scope);

    const Component = componentsRef.value[schemaRef.value.componentName] || Fragment;
    const instance = getCurrentInstance();

    if (isFragment(Component)) {
      onMounted(() => {
        instance?.proxy && triggerCompGetCtx(schemaRef.value, instance.proxy);
      });
    }

    return wrapRender(() => {
      return renderComp(schemaRef.value, scope, componentsRef.value.Block || Fragment);
    });
  },
});
