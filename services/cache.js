const mongoose = require('mongoose');
const redis = require('redis');
const util = require('util');

const redisUrl = 'redis://127.0.0.1:6379';
const client = redis.createClient(redisUrl);
client.get = util.promisify(client.get);
const exec = mongoose.Query.prototype.exec;

mongoose.Query.prototype.cache = function (options = {}) {
	this.useCache = true;
	this.hashKey = JSON.stringify(options.key || '');
	return this;
};
mongoose.Query.prototype.exec = async function () {
	//safe copy properties from one object to another copy to {} object from getQuery and collection
	if (!this.useCache) {
		return exec.apply(this.argument);
	}
	const key = JSON.stringify(Object.assign({}, this, this.getQuery(), { collection: this.mongooseCollection.name }));

	//see if we have avlue for key in redis
	const cacheValue = await client.hget(this.hashKey, key);
	//if we do return that
	if (cacheValue) {
		const doc = new this.model(JSON.parse(cacheValue));
		return Array.isArray(doc) ? doc.map((d) => new this.model(d)) : new this.model(doc);
	}

	const result = await exec.apply(this, arguments);
	client.hset(this.hashKey, key, JSON.stringify(result), 'EX', 10);
	return result;
};

module.exports = {
	clearHash(hashKey) {
		client.del(JSON.stringify(hashKey));
	}
};
