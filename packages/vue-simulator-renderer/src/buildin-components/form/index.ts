//@ts-nocheck
/* eslint-disable */
import { defineComponent } from 'vue';
import { h } from '@formily/vue';
import { MaterialForm, ButtonGroup, Submit, Reset } from '@im/lowcode-material';
import { formCore } from '@im/lowcode-shared';
import '@im/lowcode-material/dist/theme.css';
import 'h_ui/dist/lib/theme-chalk/common/index.css';

import setTheme, { setCustomTheme } from '@im/colors';
import { colorsMap, commomVariable } from '@im/ui/dist/colorMap-sd.js';
const colorData = setTheme('#4686F2', {
  theme: 'dark',
  backgroundColor: '#272729',
});
const map = { dark: {}, default: {}, ...commomVariable };
Object.keys(colorsMap).forEach((key) => {
  map.dark[key] = colorsMap[key].dark;
  map.default[key] = colorsMap[key].default;
});
setCustomTheme(map, colorData);

const formItemType = {
  Input: () => 'string',
  Money: () => 'string',
  Select: (props) => (props.multiple ? 'array' : 'string'),
  SelectTree: (props) => (props.multiple ? 'array' : 'string'),
  Radio: () => 'string',
  Checkbox: () => 'array',
  Switch: () => 'string',
  DatePicker: (props) =>
    props.type === 'daterange' || props.type === 'datetimerange' ? 'array' : 'string',
};
const { createForm } = formCore;
const getFormItems = (config) => {
  return config.reduce((result, cur, index) => {
    const { fileName, componentName, label } = cur;
    result = {
      ...result,
      [fileName || componentName]: {
        type: formItemType[componentName],
        title: label,
        'x-decorator': 'FormItem',
        'x-component': componentName,
        'x-component-props': {},
      },
    };
    return result;
  }, {});
};
const getPanelProperties = (panels, config) => {
  return panels.reduce((prev, cur, index) => {
    prev = {
      ...prev,
      [`panel${index}`]: {
        type: 'void',
        'x-component': 'FormCollapse.Item',
        'x-component-props': {
          ...cur,
        },
        properties: {
          grid: {
            type: 'void',
            'x-component': 'FormGrid',
            'x-component-props': {},
            properties: getFormItems(config),
          },
        },
      },
    };
    return prev;
  }, {});
};

const imFormProps = {
  panels: { type: Array, default: () => [] },
  config: { type: Array, default: () => [] },
  operations: { type: Array, default: () => [] },
};
const Form = defineComponent({
  name: 'FcForm',
  props: imFormProps,
  setup(props) {
    console.log(props, 'comp1111 propsForm');

    return () => {
      const { panels = [], config = [] } = props;
      const form = new createForm();
      const schema = {
        type: 'object',
        properties: {
          collapse: {
            type: 'void',
            'x-component': 'FormCollapse',
            'x-component-props': {},
            properties: getPanelProperties(panels, config),
          },
        },
      };
      console.log(schema, 'schema');
      return h(MaterialForm, { props: { form, schema } }, [() => 'FcForm']);
    };
  },
});

export default Form;
