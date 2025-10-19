// Route Caching Utility
// This utility handles saving and loading optimized routes from the backend cache
class RouteCache {
    constructor() {
        this.baseUrl = 'http://localhost:3000/api';
    }

    /**
     * Save optimized routes to cache
     * @param {Array} routes - The optimized routes to save
     * @param {string} name - Unique timestamp identifier
     * @param {Object} metadata - Additional metadata about the routes
     */
    async saveRoutes(routes, name, metadata = {}) {
        try {
            console.log('💾 Saving routes to cache...');
            console.log('🔍 Parameters:', { name, nameType: typeof name, routesLength: routes?.length, metadata });
            const response = await fetch(`${this.baseUrl}/cache-routes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, routes, metadata })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('✅ Routes saved to cache:', result);
            return result;
        } catch (error) {
            console.error('❌ Error saving routes to cache:', error);
            throw error;
        }
    }

    /**
     * Load cached routes by timestamp
     * @param {string} name - Unique timestamp identifier
     * @returns {Object} The cached route data
     */
    async loadRoutes(name) {
        try {
            console.log('📦 Loading routes from cache...');
            const response = await fetch(`${this.baseUrl}/cached-routes/${name}`);
            
            if (!response.ok) {
                if (response.status === 404) {
                    console.log('📭 No cached routes found for filename:', name);
                    return null;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('✅ Routes loaded from cache:', name);
            return result;
        } catch (error) {
            console.error('❌ Error loading routes from cache:', error);
            throw error;
        }
    }

    /**
     * List all cached routes
     * @returns {Array} List of cached route metadata
     */
    async listCachedRoutes(retries = 3) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                console.log(`📋 Fetching list of cached routes... (attempt ${attempt}/${retries})`);
                const response = await fetch(`${this.baseUrl}/cached-routes`);
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const result = await response.json();
                console.log(`✅ Found ${result.routes.length} cached route sets`);
                return result.routes;
            } catch (error) {
                console.error(`❌ Error listing cached routes (attempt ${attempt}/${retries}):`, error);
                
                if (attempt === retries) {
                    throw error;
                }
                
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
    }

    /**
     * Delete cached routes by timestamp
     * @param {string} timestamp - Unique timestamp identifier
     */
    async deleteRoutes(name) {
        try {
            console.log('🗑️ Deleting routes from cache...');
            const response = await fetch(`${this.baseUrl}/cached-routes/${name}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('✅ Routes deleted from cache:', name);
            return result;
        } catch (error) {
            console.error('❌ Error deleting routes from cache:', error);
            throw error;
        }
    }
}

// Create global instance
window.routeCache = new RouteCache();
console.log('✅ Route Cache utility initialized');
