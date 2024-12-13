// @ts-nocheck
import { ref, type PropType } from 'vue';
import type { DocumentInstance, VueSimulatorRenderer } from './interface';
import { defineComponent, h } from 'vue';
import LowCodeRenderer from '@knxcloud/lowcode-vue-renderer';
import { RouterView } from 'vue-router';
export const Layout = defineComponent({
  props: {
    simulator: {
      type: Object as PropType<VueSimulatorRenderer>,
      required: true,
    },
  },
  // setup(props, { slots }) {
  //   const { simulator } = props;
  //   const { layout, getComponent } = simulator;
  //   return () => {
  //     if (layout) {
  //       const { Component, props = {}, componentName } = layout;
  //       if (Component) {
  //         return h(Component, { ...props, key: 'layout', simulator } as any, slots);
  //       }
  //       const ComputedComponent = componentName && getComponent(componentName);
  //       if (ComputedComponent) {
  //         return h(ComputedComponent, { ...props, key: 'layout', simulator }, slots);
  //       }
  //     }
  //     return h('slot');
  //   };
  // },
  render() {
    //@ts-ignore
    const { simulator, $slots } = this;
    const { layout, getComponent } = simulator;
    if (layout) {
      const { Component, props = {}, componentName } = layout;
      if (Component) {
        //@ts-ignore
        return h(
          Component,
          {
            key: 'layout',
            props: {
              ...props,
              simulator,
            },
          } as any,
          $slots,
        );
      }
      const ComputedComponent = componentName && getComponent(componentName);
      if (ComputedComponent) {
        //@ts-ignore@
        return h(
          ComputedComponent,
          {
            key: 'layout',
            props: {
              ...props,
              simulator,
            },
          },
          $slots,
        );
      }
    }
    return $slots.default;
  },
});

export const SimulatorRendererView = defineComponent({
  props: {
    simulator: {
      type: Object as PropType<VueSimulatorRenderer>,
      required: true,
    },
  },
  render() {
    //@ts-ignore@
    const { simulator } = this;
    return h(Layout, { props: { simulator } }, [
      h(RouterView, null, {
        default: ({ Component }) => {
          return Component && h(Component);
        },
      }),
    ]);
  },
});

export const Renderer = defineComponent({
  props: {
    simulator: {
      type: Object as PropType<VueSimulatorRenderer>,
      required: true,
    },
    documentInstance: {
      type: Object as PropType<DocumentInstance>,
      required: true,
    },
  },
  setup: () => ({ renderer: ref() }),
  render() {
    const { documentInstance, simulator } = this;
    const { schema, scope, messages, appHelper, key } = documentInstance;
    const { designMode, device, locale, components, requestHandlersMap } = simulator;
    return h(LowCodeRenderer, {
      ref: 'renderer',
      key: key,
      props: {
        scope: scope,
        schema: schema,
        locale: locale,
        device: device,
        messages: messages,
        appHelper: appHelper,
        components: components,
        designMode: designMode,
        requestHandlersMap: requestHandlersMap,
        disableCompMock: simulator.disableCompMock,
        thisRequiredInJSE: simulator.thisRequiredInJSE,
        getNode: (id) => documentInstance.getNode(id) as any,
        onCompGetCtx: (schema, ref) => {
          console.log(ref, 'refrefref');
          return documentInstance.mountInstance(schema.id!, ref);
        },
      },
    });
  },
});
