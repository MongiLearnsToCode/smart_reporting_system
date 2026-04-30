import {
	type RouteConfigEntry,
	index,
	route,
} from '@react-router/dev/routes';

// Discover all page.jsx files using Vite's import.meta.glob
const pageFiles = import.meta.glob('./**/page.jsx', { eager: true });

type Tree = {
	path: string;
	children: Tree[];
	hasPage: boolean;
};

function buildRouteTree(): Tree {
	const root: Tree = {
		path: '',
		children: [],
		hasPage: false,
	};

	for (const filePath in pageFiles) {
		// filePath is like './page.jsx' or './account/signin/page.jsx'
		const pathParts = filePath.replace('./', '').split('/');
		pathParts.pop(); // remove 'page.jsx'

		let currentNode = root;

		if (pathParts.length === 0) {
			root.hasPage = true;
			continue;
		}

		let currentPath = '';
		for (const part of pathParts) {
			currentPath = currentPath ? `${currentPath}/${part}` : part;
			let child = currentNode.children.find((c) => c.path === currentPath);
			if (!child) {
				child = {
					path: currentPath,
					children: [],
					hasPage: false,
				};
				currentNode.children.push(child);
			}
			currentNode = child;
		}
		currentNode.hasPage = true;
	}

	return root;
}

function generateRoutes(node: Tree): RouteConfigEntry[] {
	const routes: RouteConfigEntry[] = [];

	if (node.hasPage) {
		const componentPath =
			node.path === '' ? `./page.jsx` : `./${node.path}/page.jsx`;

		if (node.path === '') {
			routes.push(index(componentPath));
		} else {
			// Handle parameter routes
			let routePath = node.path;

			// Replace all parameter segments in the path
			const segments = routePath.split('/');
			const processedSegments = segments.map((segment) => {
				if (segment.startsWith('[') && segment.endsWith(']')) {
					const paramName = segment.slice(1, -1);

					// Handle catch-all parameters (e.g., [...ids] becomes *)
					if (paramName.startsWith('...')) {
						return '*'; // React Router's catch-all syntax
					}
					// Handle optional parameters (e.g., [[id]] becomes :id?)
					if (paramName.startsWith('[') && paramName.endsWith(']')) {
						return `:${paramName.slice(1, -1)}?`;
					}
					// Handle regular parameters (e.g., [id] becomes :id)
					return `:${paramName}`;
				}
				return segment;
			});

			routePath = processedSegments.join('/');
			routes.push(route(routePath, componentPath));
		}
	}

	for (const child of node.children) {
		routes.push(...generateRoutes(child));
	}

	return routes;
}

const tree = buildRouteTree();
const notFound = route('*', './__create/not-found.tsx');
const routes = [...generateRoutes(tree), notFound];

export default routes;
