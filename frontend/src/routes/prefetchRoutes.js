const routeImports = {
  '/': () => import('../pages/Dashboard'),
  '/members': () => import('../pages/Members'),
  '/classes': () => import('../pages/Classes'),
  '/payments': () => import('../pages/Payments'),
  '/analytics': () => import('../pages/Analytics'),
  '/settings': () => import('../pages/Settings'),
}

export function prefetchRoute(pathname) {
  const loader = routeImports[pathname]
  if (!loader) return
  try {
    loader()
  } catch {
    // ignore
  }
}

export function prefetchAllRoutes() {
  Object.values(routeImports).forEach((loader) => {
    try {
      loader()
    } catch {
      // ignore
    }
  })
}
