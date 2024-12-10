//@ts-nocheck
import { defineComponent } from 'vue';
import { h } from '@formily/vue';
const Page = defineComponent({
  setup(props, { slots }) {
    return () => h('div', { class: 'lc-page', props }, slots);
  },
});

Object.assign(Page, {
  displayName: 'Page',
  componentMetadata: {
    componentName: 'Page',
    configure: {
      supports: {
        style: true,
        className: true,
      },
      component: {
        isContainer: true,
        disableBehaviors: '*',
      },
    },
  },
});

export default Page;
