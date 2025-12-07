class Router {
    constructor() {
        this.routes = {
            GET: new Map(),
            POST: new Map(),
            PUT: new Map(),
            DELETE: new Map(),
            PATCH: new Map()
        };
    }

    // Register GET route
    get(path, handler) {
        if (typeof handler !== 'function') {
            throw new Error('Handler must be a function');
        }
        this.routes.GET.set(path, handler);
    }

    // Register POST route
    post(path, handler) {
        if (typeof handler !== 'function') {
            throw new Error('Handler must be a function');
        }
        this.routes.POST.set(path, handler);
    }

    // Register PUT route
    put(path, handler) {
        if (typeof handler !== 'function') {
            throw new Error('Handler must be a function');
        }
        this.routes.PUT.set(path, handler);
    }

    // Register DELETE route
    delete(path, handler) {
        if (typeof handler !== 'function') {
            throw new Error('Handler must be a function');
        }
        this.routes.DELETE.set(path, handler);
    }

    // Register PATCH route
    patch(path, handler) {
        if (typeof handler !== 'function') {
            throw new Error('Handler must be a function');
        }
        this.routes.PATCH.set(path, handler);
    }

    // Find route handler
    find(method, pathname) {
        const methodRoutes = this.routes[method];
        
        if (!methodRoutes) {
            return null;
        }

        // First try exact match
        if (methodRoutes.has(pathname)) {
            return methodRoutes.get(pathname);
        }

        // Then try wildcard match (*)
        if (methodRoutes.has('*')) {
            return methodRoutes.get('*');
        }

        // Check for dynamic routes (e.g., /users/:id)
        for (const [route, handler] of methodRoutes.entries()) {
            if (route.includes(':')) {
                const routePattern = this.createRoutePattern(route);
                if (routePattern.test(pathname)) {
                    return handler;
                }
            }
        }

        return null;
    }

    // Create regex pattern for dynamic routes
    createRoutePattern(route) {
        const pattern = route
            .replace(/\//g, '\\/')
            .replace(/:\w+/g, '([^/]+)');
        return new RegExp(`^${pattern}$`);
    }

    // Get all routes for debugging
    getAllRoutes() {
        const allRoutes = {};
        for (const [method, routes] of Object.entries(this.routes)) {
            allRoutes[method] = Array.from(routes.keys());
        }
        return allRoutes;
    }
}

module.exports = Router;