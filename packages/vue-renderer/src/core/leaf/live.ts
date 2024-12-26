//@ts-nocheck
import { defineComponent, toRaw } from 'vue';
import { h } from '@formily/vue';
// import { mergeProps } from '../../utils/mergeProps';
import { isFragment, splitLeafProps } from '../use';
import { leafProps } from '../base';

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

      const events = Object.keys(compProps).reduce((r, c) => {
        if (compProps[c] && c.startsWith('on') && typeof compProps[c] === 'function') {
          r[c] = compProps[c].bind(props.__scope);
          const ext = c.replace('on', '');
          if (ext && ext[0]) {
            r[ext[0].toLocaleLowerCase() + ext.substring(1)] = compProps[c].bind(
              props.__scope,
            );
            // r[c.replace('on', 'on-')] = compProps[c];
          }
        }

        return r;
      }, {});
      console.log(events, compProps, 'compProps comp1111123');
      return comp
        ? h(
            comp,
            {
              ...vnodeProps,
              ...compProps,
              attrs: compProps,
              props: compProps,
              on: events,
            },
            slots,
          )
        : null;
    };
  },
});
