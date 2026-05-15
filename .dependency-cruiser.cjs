module.exports = {
	forbidden: [],
	options: {
		doNotFollow: {
			path: "node_modules",
		},
		exclude: {
			path: ["node_modules", "bun.lock", "Cargo.lock", "target", "dist", "coverage"],
		},
		tsPreCompilationDeps: true,
		enhancedResolveOptions: {
			exportsFields: ["exports"],
			conditionNames: ["import", "types", "node", "default"],
		},
	},
};
