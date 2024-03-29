const fs = require("fs")


class Cache{
	constructor(cachepath){
		this.path = cachepath;
	}

	put(key, value){
		fs.writeFileSync(`${this.path}/${key}.json`, JSON.stringify(value))
	}

	get(key){
		return JSON.parse(fs.readFileSync(`${this.path}/${key}.json`, "utf8"))
	}
}


module.exports = {
	Cache
}
