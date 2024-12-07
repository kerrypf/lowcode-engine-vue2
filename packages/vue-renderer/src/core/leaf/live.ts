//@ts-nocheck
import { defineComponent, toRaw } from 'vue';
import { h } from '@formily/vue';
// import { mergeProps } from '../../utils/mergeProps';
import { isFragment, splitLeafProps } from '../use';
import { leafProps } from '../base';
import { mergeProps } from '../../utils/vue-runtime-core';

export const Live = defineComponent({
  inheritAttrs: false,
  props: leafProps,
  setup: (props, { attrs, slots }) => {
    return () => {
      const comp = toRaw(props.__comp);
      const vnodeProps = { ...props.__vnodeProps };
      const compProps = splitLeafProps(attrs)[1];
      if (isFragment(comp)) {
        // return renderSlot(slots, 'default', attrs);
        return slots.default?.(attrs);
      }
      return comp ? h(comp, { props: mergeProps(compProps, vnodeProps) }, slots) : null;
    };
  },
});
