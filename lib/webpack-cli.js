const { join } = require("path");
const GroupHelper = require("./utils/group-helper");
const Compiler = require('./instance');

class webpackCLI extends GroupHelper {
	constructor() {
		super();
		this.groupMap = new Map();
		this.groups = [];
		this.processingErrors = [];
		this.shouldUseMem = false;
	}
	setMappedGroups(args, yargsOptions) {
		const { _all } = args;
		Object.keys(_all).forEach(key => {
			this.setGroupMap(key, _all[key], yargsOptions);
		});
	}
	setGroupMap(key, val, yargsOptions) {
		const opt = yargsOptions.find(opt => opt.name === key);
		const groupName = opt.group;
		const namePrefix = groupName.slice(0, groupName.length - 9).toLowerCase();
		if (this.groupMap.has(namePrefix)) {
			const pushToMap = this.groupMap.get(namePrefix);
			pushToMap.push({ [opt.name]: val });
		} else {
			this.groupMap.set(namePrefix, [{ [opt.name]: val }]);
		}
	}
	formatDashedArgs() {}

	resolveGroups() {
		for (const [key, value] of this.groupMap.entries()) {
			const fileName = join(__dirname, "groups", key);
			const GroupClass = require(fileName);
			const GroupInstance = new GroupClass(value);
			this.groups.push(GroupInstance);
		}
	}

	mergeGroupResults(acc, curr) {
		if(curr.options) {
			acc.options = this.mergeRecursive(acc.options, curr.options);
		}
		if(curr.outputOptions) {
			acc.outputOptions = this.mergeRecursive(acc.outputOptions, curr.outputOptions);
		}
		if(curr.processingErrors) {
			acc.processingErrors = acc.processingErrors.concat(curr.processingErrors);
		}
		return acc;
	}
	
	runOptionGroups() {
		return this.groups.map(Group => Group.run()).filter(e => e).reduce(this.mergeGroupResults.bind(this), {
			outputOptions: {},
			options: {},
			processingErrors: []
		});
	}

	async run(args, yargsOptions) {
		await this.setMappedGroups(args, yargsOptions);
		await this.resolveGroups();
		const groupResult = await this.runOptionGroups();
		console.log(groupResult)
		const webpack = await Compiler(groupResult);
		return webpack;
	}

	async runCommand(command, ...args) {
		if (command.scope === "external") {
			return require("./commands/external").run(command.name, ...args);
		}
		const InternalClass = require("./commands/internal");
		const CommandClass = new InternalClass(command, ...args);
		CommandClass.run();
		// and return to compiler scope
		return null;
	}
}

module.exports = webpackCLI;