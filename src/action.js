import { createEnhancer, isPromise } from '@financial-times/n-express-enhancer';

import { createEventLogger } from './event';
import { LOG_LEVELS } from './constants';

const logAction = actionFunction => (paramsOrArgs, meta, ...excessive) => {
	if (
		excessive.length ||
		(paramsOrArgs !== undefined && typeof paramsOrArgs !== 'object') ||
		(meta !== undefined && typeof meta !== 'object')
	) {
		throw Error(
			`input args of autoLogged function [${
				actionFunction.name
			}] needs to (params: Object, meta?: Object)`,
		);
	}

	const event = createEventLogger({
		...meta,
		action: actionFunction.name,
		...paramsOrArgs,
	});
	const { AUTO_LOG_LEVEL = LOG_LEVELS.verbose } = process.env;
	if (AUTO_LOG_LEVEL === LOG_LEVELS.verbose) event.start();

	try {
		const call = actionFunction(paramsOrArgs, meta);
		if (isPromise(call)) {
			return call
				.then(data => {
					if (AUTO_LOG_LEVEL === LOG_LEVELS.verbose) event.success();
					return data;
				})
				.catch(e => {
					if (AUTO_LOG_LEVEL !== LOG_LEVELS.error) event.failure(e);
					throw e;
				});
		}
		const data = call;
		if (AUTO_LOG_LEVEL === LOG_LEVELS.verbose) event.success();
		return data;
	} catch (e) {
		if (AUTO_LOG_LEVEL !== LOG_LEVELS.error) event.failure(e);
		throw e;
	}
};

export default createEnhancer(logAction);
