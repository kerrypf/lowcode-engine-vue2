// @ts-nocheck
import type {
  IPublicTypeContainerSchema,
  IPublicModelDocumentModel,
} from '@alilc/lowcode-types';
import Vue, {
  type Ref,
  ref,
  shallowRef,
  reactive,
  computed,
  markRaw,
  onUnmounted,
  shallowReactive, //用于创建一个浅层响应式对象
} from 'vue';
import * as VueRouter from 'vue-router';
import type {
  ComponentInstance,
  ComponentRecord,
  DocumentInstance,
  MixedComponent,
  SimulatorViewLayout,
  VueSimulatorRenderer,
} from './interface';
import {
  config,
  LOWCODE_ROUTE_META,
  SchemaParser,
  setupLowCodeRouteGuard,
} from '@knxcloud/lowcode-vue-renderer';
import {
  AssetLoader,
  buildUtils,
  buildComponents,
  getSubComponent,
  exportSchema,
  isArray,
} from '@knxcloud/lowcode-utils';
import { Renderer, SimulatorRendererView } from './simulator-view';
import { Slot, Leaf, Page, FcForm } from './buildin-components';
import { host } from './host';
import {
  cursor,
  deepMerge,
  findDOMNodes,
  getClientRects,
  getCompRootData,
  setCompRootData,
  getClosestNodeInstance,
  isComponentRecord,
  getClosestNodeInstanceByComponent,
  setNativeSelection,
  createComponentRecord,
  parseFileNameToPath,
  isVNodeHTMLElement,
  CompRootHTMLElement,
} from './utils';

Object.assign(window, { VueRouter });

const loader = new AssetLoader();

const builtinComponents = { Slot, Leaf, Page, FcForm };

export interface ProjectContext {
  i18n: Record<string, object>;
  appHelper: {
    utils?: Record<string, unknown>;
    constants?: Record<string, unknown>;
    [x: string]: unknown;
  };
  suspense: boolean;
}

function createDocumentInstance(
  document: IPublicModelDocumentModel,
  context: ProjectContext,
): DocumentInstance {
  /** 记录单个节点的组件实例列表 */
  const instancesMap = new Map<string, ComponentInstance[]>();
  /** 记录 vue 组件实例和组件 uid 的映射关系 */
  const vueInstanceMap = new Map<number, ComponentInstance>();

  const timestamp = ref(Date.now());

  const schema = computed<IPublicTypeContainerSchema>(() => {
    void timestamp.value;
    return (
      exportSchema(document) ?? {
        fileName: '/',
        componentName: 'Page',
      }
    );
  });

  const checkInstanceMounted = (instance: ComponentInstance | HTMLElement): boolean => {
    //@ts-ignore
    return '$' in instance ? instance.$.isMounted : !!instance;
  };

  const setHostInstance = (
    docId: string,
    nodeId: string,
    instances: ComponentInstance[] | null,
  ) => {
    const instanceRecords = !instances
      ? null
      : instances.map((inst) => createComponentRecord(docId, nodeId, inst._uid));
    host.setInstance(docId, nodeId, instanceRecords);
  };

  const getComponentInstance = (id: number) => {
    return vueInstanceMap.get(id);
  };

  const mountInstance = (id: string, instanceOrEl: ComponentInstance | HTMLElement) => {
    const docId = document.id;
    if (instanceOrEl == null) {
      let instances = instancesMap.get(id);
      if (instances) {
        instances = instances.filter(checkInstanceMounted);
        if (instances.length > 0) {
          instancesMap.set(id, instances);
          setHostInstance(docId, id, instances);
        } else {
          instancesMap.delete(id);
          setHostInstance(docId, id, null);
        }
      }
      return;
    }

    let el: CompRootHTMLElement;
    let instance: ComponentInstance;
    if (instanceOrEl.$el) {
      //@ts-ignore
      instance = instanceOrEl;
      //@ts-ignore@
      el = instance.$el;
    } else if (isVNodeHTMLElement(instanceOrEl)) {
      //@ts-ignore
      instance = instanceOrEl.__vueParentComponent.proxy!;
      // @ts-expect-error
      el = instanceOrEl;
    } else {
      return;
    }

    const origId = getCompRootData(el).nodeId;
    if (origId && origId !== id) {
      // 另外一个节点的 instance 在此被复用了，需要从原来地方卸载
      unmountInstance(origId, instance);
    }

    onUnmounted(() => unmountInstance(id, instance), instance);

    setCompRootData(el, {
      nodeId: id,
      docId: docId,
      instance: instance,
    });
    let instances = instancesMap.get(id);
    if (instances) {
      const l = instances.length;
      instances = instances.filter(checkInstanceMounted);
      let updated = instances.length !== l;
      if (!instances.includes(instance)) {
        instances.push(instance);
        updated = true;
      }
      if (!updated) return;
    } else {
      instances = [instance];
    }
    vueInstanceMap.set(instance._uid, instance);
    instancesMap.set(id, instances);
    setHostInstance(docId, id, instances);
  };

  const unmountInstance = (id: string, instance: ComponentInstance) => {
    const instances = instancesMap.get(id);
    if (instances) {
      const i = instances.indexOf(instance);
      if (i > -1) {
        const [instance] = instances.splice(i, 1);
        vueInstanceMap.delete(instance._uid);
        setHostInstance(document.id, id, instances);
      }
    }
  };

  const getNode: DocumentInstance['getNode'] = (id) => {
    // @ts-expect-error getNodeById 不存在，使用 getNode 代替，这里的 ts 类型声明不正确
    return id ? document.getNode(id) : null;
  };

  return reactive({
    id: computed(() => document.id),
    path: computed(() => parseFileNameToPath(schema.value.fileName ?? '')),
    get key() {
      return `${document.id}:${timestamp.value}`;
    },
    scope: computed(() => ({})),
    schema: schema,
    appHelper: computed(() => {
      const _schema = schema.value;

      const {
        utils: utilsInContext,
        constants: constantsInContext,
        ...otherHelpers
      } = context.appHelper;

      return {
        utils: {
          ...utilsInContext,
          ...buildUtils(host.libraryMap, Reflect.get(_schema, 'utils') ?? []),
        },
        constants: {
          ...constantsInContext,
          ...Reflect.get(_schema, 'constants'),
        },
        ...otherHelpers,
      };
    }),
    document: computed(() => document),
    messages: computed(() => deepMerge(context.i18n, Reflect.get(schema.value, 'i18n'))),
    instancesMap: computed(() => instancesMap),
    getNode,
    mountInstance,
    unmountInstance,
    getComponentInstance,
    rerender: () => {
      const now = Date.now();
      if (context.suspense) {
        Object.assign(timestamp, {
          _value: now,
          _rawValue: now,
        });
      } else {
        timestamp.value = now;
      }
      SchemaParser.cleanCachedModules();
    },
  }) as DocumentInstance;
}

function createSimulatorRenderer() {
  const layout: Ref<SimulatorViewLayout> = shallowRef({});
  const device: Ref<string> = shallowRef('default');
  const locale: Ref<string | undefined> = shallowRef();
  const autoRender = shallowRef(host.autoRender);
  const designMode: Ref<string> = shallowRef('design');
  const libraryMap: Ref<Record<string, string>> = shallowRef({});
  const components: Ref<Record<string, ComponentInstance>> = shallowRef({});
  const componentsMap: Ref<Record<string, MixedComponent>> = shallowRef({});
  const disableCompMock: Ref<boolean | string[]> = shallowRef(true);
  const requestHandlersMap: Ref<Record<string, CallableFunction>> = shallowRef({});
  const documentInstances: Ref<DocumentInstance[]> = shallowRef([]);
  const thisRequiredInJSE: Ref<boolean> = shallowRef(false);

  const context: ProjectContext = shallowReactive({
    i18n: {},
    appHelper: {
      utils: {},
      constants: {},
    },
    suspense: false,
  });

  const disposeFunctions: Array<() => void> = [];

  const documentInstanceMap = new Map<string, DocumentInstance>();

  function _buildComponents() {
    components.value = {
      ...builtinComponents,
      ...buildComponents(libraryMap.value, componentsMap.value),
    };
  }
  const simulator = reactive({
    config: markRaw(config),
    layout,
    device,
    locale,
    designMode,
    libraryMap,
    components,
    autoRender,
    componentsMap,
    disableCompMock,
    documentInstances,
    requestHandlersMap,
    thisRequiredInJSE,
    isSimulatorRenderer: true,
  }) as VueSimulatorRenderer;

  /**
   * 创建路由实例
   * VueRouter.createRouter({
      history: VueRouter.createMemoryHistory('/'),
      routes: [],
   * })
   */
  const router = new VueRouter.default({
    mode: 'history',
    routes: [],
  });
  /**
   * 创建组件实例
   * createApp(SimulatorRendererView, { simulator })
   */
  const simulatorApp = new Vue({
    router,
    render: (h) => h(SimulatorRendererView, { props: { simulator } }),
  });
  // const simulatorConstructor = Vue.extend(SimulatorRendererView);

  // const simulatorApp = new simulatorConstructor({
  //   propsData: {
  //     simulator,
  //   },
  // });
  simulator.app = markRaw(simulatorApp);
  simulator.router = markRaw(router);
  simulator.router.hasRoute = (routeName) => {
    const routes = router.getRoutes();
    const routeExists = routes.some((route) => route.name === routeName);
    return routeExists;
  };
  // simulator.router.removeRoute = (routeName) => {
  //   // 获取当前的所有路由
  //   const routes = router.getRoutes();

  //   // 找到需要删除的路由
  //   const routeToRemove = routes.find((route) => route.name === routeName);

  //   if (routeToRemove) {
  //     // 删除指定的路由
  //     router.matcher.routes = router.matcher.routes.filter(
  //       (route) => route !== routeToRemove,
  //     );
  //   }
  // };
  simulator.getComponent = (componentName) => {
    const paths = componentName.split('.');
    const subs: string[] = [];
    while (paths.length > 0) {
      const component = components.value[componentName];
      if (component) {
        return getSubComponent(component, subs);
      }
      const sub = paths.pop();
      if (!sub) break;
      subs.unshift(sub);
      componentName = paths.join('.');
    }
    return null!;
  };

  simulator.getClosestNodeInstance = (el, specId) => {
    if (isComponentRecord(el)) {
      const { cid, did } = el;
      const documentInstance = documentInstanceMap.get(did);
      const instance = documentInstance?.getComponentInstance(cid) ?? null;
      return instance && getClosestNodeInstanceByComponent(instance.$, specId);
    }
    return getClosestNodeInstance(el, specId);
  };

  simulator.findDOMNodes = (instance: ComponentRecord) => {
    if (instance) {
      const { did, cid } = instance;
      const documentInstance = documentInstanceMap.get(did);
      const compInst = documentInstance?.getComponentInstance(cid);
      return compInst ? findDOMNodes(compInst) : null;
    }
    return null;
  };
  simulator.getComponent = (componentName) => components.value[componentName];

  simulator.getClientRects = (element) => getClientRects(element);
  simulator.setNativeSelection = (enable) => setNativeSelection(enable);
  simulator.setDraggingState = (state) => cursor.setDragging(state);
  simulator.setCopyState = (state) => cursor.setCopy(state);
  simulator.clearState = () => cursor.release();
  simulator.rerender = () => documentInstances.value.forEach((doc) => doc.rerender());
  simulator.dispose = () => {
    simulator.app.$destroy();
    disposeFunctions.forEach((fn) => fn());
  };
  simulator.getCurrentDocument = () => {
    const crr = host.project.currentDocument;
    const docs = documentInstances.value;
    return crr ? docs.find((doc) => doc.id === crr.id) ?? null : null;
  };
  simulator.load = (assets) => loader.load(assets);
  simulator.loadAsyncLibrary = async (asyncLibraryMap) => {
    await loader.loadAsyncLibrary(asyncLibraryMap);
    _buildComponents();
  };

  let running = false;
  simulator.run = () => {
    if (running) return;
    running = true;
    const containerId = 'app';
    let container = document.getElementById(containerId);
    if (!container) {
      container = document.createElement('div');
      document.body.appendChild(container);
      container.id = containerId;
    }
    document.documentElement.classList.add('engine-page');
    document.body.classList.add('engine-document');
    // simulator.app.use(simulator.router).mount(container);
    simulator.app.$mount(container);
    host.project.setRendererReady(simulator);
  };

  disposeFunctions.push(
    host.connect(simulator, () => {
      const config = host.project.get('config') || {};

      // sync layout config
      layout.value = config.layout ?? {};
      // sync disableCompMock
      disableCompMock.value = isArray(config.disableCompMock)
        ? config.disableCompMock
        : Boolean(config.disableCompMock);

      // todo: split with others, not all should recompute
      if (
        libraryMap.value !== host.libraryMap ||
        componentsMap.value !== host.designer.componentsMap
      ) {
        libraryMap.value = host.libraryMap || {};
        //@ts-ignore
        componentsMap.value = host.designer.componentsMap;
        _buildComponents();
      }

      locale.value = host.locale;

      // sync device
      device.value = host.device;

      // sync designMode
      designMode.value = host.designMode;

      // sync requestHandlersMap
      requestHandlersMap.value = host.requestHandlersMap ?? {};

      thisRequiredInJSE.value = host.thisRequiredInJSE ?? false;

      documentInstances.value.forEach((doc) => doc.rerender());

      setupLowCodeRouteGuard(simulator.router, {
        thisRequired: thisRequiredInJSE.value,
        scopePath: 'renderer.runtimeScope',
      });
    }),
  );

  disposeFunctions.push(
    host.autorun(async () => {
      const { router } = simulator;

      documentInstances.value = host.project.documents.map((doc) => {
        let documentInstance = documentInstanceMap.get(doc.id);
        if (!documentInstance) {
          // TODO: 类型不兼容 IDocumentModel to DocumentModel，暂时用类型强转处理
          documentInstance = createDocumentInstance(doc as any, context);
          documentInstanceMap.set(doc.id, documentInstance);
        } else if (router.hasRoute(documentInstance.id)) {
          const newRouter = new VueRouter.default({
            mode: 'history',
            routes: [],
          });
          router.matcher = newRouter.matcher;
          // router.removeRoute(documentInstance.id);
        }
        console.log('simulator', simulator);
        router.addRoute({
          name: documentInstance.id,
          path: documentInstance.path,
          meta: {
            [LOWCODE_ROUTE_META]: documentInstance.schema,
          },
          component: Renderer,
          props: ((doc, sim) => () => ({
            simulator: sim,
            documentInstance: doc,
          }))(documentInstance, simulator),
        });
        return documentInstance;
      });

      router.getRoutes().forEach((route) => {
        const id = route.name as string;
        const hasDoc = documentInstances.value.some((doc) => doc.id === id);
        if (!hasDoc) {
          // router.removeRoute(id);//TODO
          documentInstanceMap.delete(id);
        }
      });
      const inst = simulator.getCurrentDocument();
      if (inst) {
        try {
          context.suspense = true;
          await router.replace({ name: inst.id, force: true });
        } finally {
          context.suspense = false;
        }
      }
    }),
  );

  host.componentsConsumer.consume(async (componentsAsset) => {
    if (componentsAsset) {
      await loader.load(componentsAsset);
      _buildComponents();
    }
  });

  host.injectionConsumer.consume((data) => {
    if (data.appHelper) {
      const { utils, constants, ...others } = data.appHelper;
      Object.assign(context.appHelper, {
        utils: isArray(utils) ? buildUtils(host.libraryMap, utils) : utils ?? {},
        constants: constants ?? {},
        ...others,
      });
    }
    context.i18n = data.i18n ?? {};
  });

  return simulator;
}

export default createSimulatorRenderer();
