import express from 'express';
import request from 'supertest';

import logger, { autoLog } from '../index';
import { autoLogOperation, autoLogController } from '../operation';

jest.mock('@financial-times/n-logger');

describe('autoLogOperation', () => {
	afterEach(() => {
		jest.resetAllMocks();
	});

	describe('returns a valid express middleware', () => {
		it('for non-async function', async () => {
			const operationFunction = (meta, req, res) => {
				res.status(200).send(meta);
			};
			const middleware = autoLogOperation(operationFunction);
			const app = express();
			app.use('/', middleware);
			const res = await request(app).get('/');
			expect(res.statusCode).toBe(200);
			expect(res.body).toEqual({ operation: 'operationFunction' });
		});

		it('for async function', async () => {
			const operationFunction = async (meta, req, res) => {
				res.status(200).send(meta);
			};
			const middleware = autoLogOperation(operationFunction);
			const app = express();
			app.use('/', middleware);
			const res = await request(app).get('/');
			expect(res.statusCode).toBe(200);
			expect(res.body).toEqual({ operation: 'operationFunction' });
		});
	});

	describe('invokes operation function as middleware correctly', () => {
		const middlewareFunctionsStub = {
			req: jest.fn(),
			res: jest.fn(),
			next: jest.fn(),
		};

		it('as non-async function', () => {
			const operationFunction = (meta, req, res, next) => {
				req.a = 'a';
				res.b = 'b';
				next('e');
			};
			const { req, res, next } = middlewareFunctionsStub;
			autoLogOperation(operationFunction)(req, res, next);
			expect(req.a).toBe('a');
			expect(res.b).toBe('b');
			expect(next.mock.calls).toMatchSnapshot();
		});

		it('as async function', async () => {
			const callFunction = jest.fn(() => Promise.resolve('foo'));
			const operationFunction = async (meta, req, res, next) => {
				const data = await callFunction();
				res.data = data;
				next();
			};
			const { req, res, next } = middlewareFunctionsStub;
			await autoLogOperation(operationFunction)(req, res, next);
			expect(res.data).toBe('foo');
		});

		it('next the error for error handling', async () => {
			const next = jest.fn();
			const callFunction = jest.fn(() => {
				const e = {
					status: 500,
					message: 'foo',
				};
				throw e;
			});
			const operationFunction = async meta => {
				await autoLog(callFunction)(null, meta);
			};
			await autoLogOperation(operationFunction)(null, null, next);
			expect(next.mock.calls).toMatchSnapshot();
		});
	});

	describe('logs correctly', () => {
		it('operationFunction name as .operation', () => {
			const operationFunction = () => {};
			autoLogOperation(operationFunction)();
			expect(logger.info.mock.calls).toMatchSnapshot();
		});

		it('sub actions with autoLog', async () => {
			const callFunction = jest.fn(() => Promise.resolve('foo'));
			const operationFunction = async meta => {
				await autoLog(callFunction)(null, meta);
			};
			await autoLogOperation(operationFunction)();
			expect(logger.info.mock.calls).toMatchSnapshot();
		});

		it('operation failure', async () => {
			const next = jest.fn();
			const callFunction = jest.fn(() => {
				const e = {
					status: 500,
					message: 'foo',
				};
				throw e;
			});
			const operationFunction = async meta => {
				await autoLog(callFunction)(null, meta);
			};
			await autoLogOperation(operationFunction)(null, null, next);
			expect(logger.info.mock.calls).toMatchSnapshot();
			expect(logger.error.mock.calls).toMatchSnapshot();
		});

		it('req.meta from previous middlewares', async () => {
			const metaMiddleware = (req, res, next) => {
				req.meta = {
					...req.meta,
					transactionId: 'xxxx-xxxx',
				};
				next();
			};
			const operationFunction = async (meta, req, res) => {
				res.status(200).send(meta);
			};
			const operationMiddleware = autoLogOperation(operationFunction);
			const app = express();
			app.use('/', metaMiddleware, operationMiddleware);
			const res = await request(app).get('/');
			expect(res.statusCode).toBe(200);
			expect(res.body).toMatchSnapshot();
			expect(logger.info.mock.calls).toMatchSnapshot();
		});
	});
});

describe('autoLogController', () => {
	afterEach(() => {
		jest.resetAllMocks();
	});

	it('decorate each method correctly', async () => {
		const operationFunctionA = (meta, req, res) => {
			res.status(200).send(meta);
		};
		const operationFunctionB = (meta, req, res) => {
			res.status(200).send(meta);
		};
		const enhancedController = autoLogController({
			operationFunctionA,
			operationFunctionB,
		});
		const app = express();
		app.use('/a', enhancedController.operationFunctionA);
		app.use('/b', enhancedController.operationFunctionB);
		const resA = await request(app).get('/a');
		expect(resA.statusCode).toBe(200);
		expect(resA.body).toMatchSnapshot();
		expect(logger.info.mock.calls).toMatchSnapshot();
		const resB = await request(app).get('/b');
		expect(resB.statusCode).toBe(200);
		expect(resB.body).toMatchSnapshot();
	});
});