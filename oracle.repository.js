const oracledb = require("oracledb");
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.fetchAsString = [oracledb.CLOB, oracledb.DATE];

class OracleRepository {
	 _pool;

	 async getLocationDetails(bcccode){
		let query = "BEGIN GET_BR_FC_CBC_NAME(:bcccode,:cursor); END;";
		let bindParameters = {
			bcccode: bcccode,
			cursor: { dir: oracledb.BIND_OUT, type: oracledb.DB_TYPE_CURSOR },
		};
		let result;
		let connection = await this._getConnection();

		try {
			try {
				console.log("excuting sp");
				result = await connection.execute(query, bindParameters);
				console.log("excuting sp done");

			} catch (err) {
				console.log("error executing",err);
				throw `unable to execute oracle query [Method: OracleRepository.getLocationDetails] [query: ${query}] [parameters: ${JSON.stringify(bindParameters)}]`;
			}

			let resultSet = result.outBinds.cursor;

			let queryData = await this.fetchRefCursorFromStream(resultSet);
			console.log("##################",queryData)
			try{
				return queryData[0];
			}
			catch(err){
				console.log("#@@@@@@@@@@@@@",err);

				throw `unable to json parse the result [Method: OracleRepository.getLocationDetails] [query: ${query}] [parameters: ${JSON.stringify(bindParameters)}] [err : ${err}]`
			}
		} catch (err) {
			console.log("catch",err);

			throw err;
		} finally {
			// release connection !IMPORTANT
			await this._closeConnection(connection);
		}
	}
	
	 async closePoolConnection() {
		await this._pool.close();
	}
	 fetchRefCursorFromStream(resultSet) {
		return new Promise((resolve, reject) => {
			let result = [];
			let stream = resultSet.toQueryStream();
			stream.on("error", (err) => {
				return reject(`Error While Opening a Query Stream [Method: OracleRepository.fetchRefCursorFromStream]`
				);
			});
			stream.on("data", (data) => {
				result.push(data);
			});
			stream.on("end", function () {
				stream.destroy();
			});
			stream.on("close", function () {
				return resolve(result);
			});
		});
	}
	 async getPool(option) {
		this._pool = await oracledb.createPool(option);
	}
	 async _closeConnection(connection) {
		try {
			if (connection !== undefined) {
				await connection.close();
			}
		} catch (err) {
			console.log("unknown error at OracleRepository.closeConnection: ", err);
		}
	}
	 async _getConnection() {
		try {
			//console.log("pool",this._pool, "status", this._pool.status);
			let connection = await this._pool?.getConnection();
			console.log("pool connection found");

			connection.callTimeout = 20000;
			return connection;
		} catch (err) {
			console.log("_getConnection error", err);
			throw  `unable to get database connection [Method: OracleRepository.getConnection]`;
		}
	}
}

function connect(database) {
	if (database.ISSID == 1) {
		let connectString = `(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=${database.HOST})(PORT=${database.PORT}))(CONNECT_DATA=(SID=${database.DATABASE})))`;
		return connectString;
	} else {
		let connectString = `(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=${database.HOST})(PORT=${database.PORT}))(CONNECT_DATA=(SERVICE_NAME=${database.DATABASE})))`;
		return connectString;
	}
}

let orarepo = new OracleRepository();
async function init(){

	let option ={
	user: 'base_fi_6',
	password: 'base_fi_6' ,
	connectString: connect({HOST: '10.10.30.130', PORT: 1521, DATABASE: 'orcl' }),
	poolMax: 1000, //The maximum number of connections to which a connection pool can grow.
	poolMin: 10, //The minimum number of connections which will be open.
	poolTimeout: 15, //The number of seconds after which idle connections (unused in the pool) are terminated.
	queueTimeout: 3000, //Number of milliseconds after which connection requests waiting in the connection request queue are terminated.
	enableStatistics: true,
	queueMax: 1000,
	poolAlias: "WORKFLOW",
	poolPingInterval : 10
};

await orarepo.getPool(option);
console.log("pool created");
await callSp();
}

init().catch(err =>{
	console.log("init error", err);
})


function pause(t){
	return new Promise(resolve =>{
		setTimeout(()=>{
			return resolve();
		},t)
	});	
}

async function callSp(){
	try{
		console.log("calling sp")
		let result = await orarepo.getLocationDetails('123456');
		console.log("result", result);
		await pause(20000);
		return await callSp();
		
		} catch(e){
			console.log("sp error",e);
			throw e;
		}
}


