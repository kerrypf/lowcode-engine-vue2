export function isVNode(value) {
  return value ? value.__v_isVNode === true : false;
}
