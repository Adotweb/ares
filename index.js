const WebSocket = require("ws")
const express = require("express")
const fs = require("fs")
const bodyparser = require("body-parser")
const path = require("path")


const axios = require("axios").default
const { decycle } = require("./utils")
const { stringify } = require("querystring")
const { Cache } = require("./cache")


function Try(tryable){

	try{
		return [tryable(), undefined]
	}catch(e){
		return [undefined, new Error(e)]
	}

}

function static(staticpath){

	return (req, res, next) => {

		let p = path.resolve(staticpath + req.url) 


		let isfile = p.split(".").filter(s => s !== "").length > 1

		let err1, err2; 

		if(isfile){
			err1 = Try(() => res.sendFile(p))[1]
		}else{
			err2 = Try(() => res.sendFile(p + "/index.html"))[1]
		}


		if(err1 || err2){
			next()
		}
	}

}

class AresHost{


	constructor({url, env}){

		this.port = ""
	
		this.env = env

		if(!url){
			throw new Error("url is needed!")
		}
		if(!env){
			throw new Error("env is needed!")
		}

		this.websocket = new WebSocket(url)
	
		this.websocket.sendJSON = body => this.websocket.send(JSON.stringify(body))

		this.websocket.on("open", () => {

			this.websocket.sendJSON({
				event:"host.login",
				data:env
			})
		})


		setInterval(() => {
			this.websocket.sendJSON({
				event:"keepalive",
				data:{}
			})
		}, 5000)





		this.rest = express()

		this.rest.use(express.json())
		this.rest.use(bodyparser.urlencoded())

		this.rest.use((req, res, next) => {


			let requestid = req.headers["requestid"]

			let isDevRequest = (req.originalUrl.split("/")[1] == "id" || req.originalUrl.split("/")[1] == this.env.id)


			if(isDevRequest){
				req.url = req.url.replace("/id", "")


			}


			let originalSend = res.send;
			let originalSendFile = res.sendFile; 


			res.send = body => {

				res.locals.body = body; 


				return originalSend.call(res, body)
			}

			res.sendFile = path => {

				let filebuffer = [...new Uint8Array(fs.readFileSync(path))]

				res.locals.body = filebuffer

				return originalSendFile.call(res, path)
			}
			
			res.on("close", () => {
				if(!requestid) return
					
				res.locals.headers = res.getHeaders()



				let data = decycle(res)	
		
				this.websocket.sendJSON({
					event:"host.rest.response",
					data:{...data, requestid}
				})
			})

			next()
		})

		
	}


	listen(port){





		this.rest.listen(port)

		this.port = port


		this.websocket.on("message", async msg => {

			const {event, data} = JSON.parse(msg)


			switch(event){


				case "client.rest.request": 
		

					const body = (data.method == "POST") ? data.request.body : undefined
				
					let headers = {};
					let headersArray = data.request.rawHeaders


					headersArray = headersArray.map((s, i) => {
						if(i % 2 == 0){
							return [
								s,headersArray[i + 1]
							]
						}
						return undefined
					}).filter(s => s!==undefined).forEach(s => {

						headers[s[0]] = s[1]	
					})
					
					headers["Content-Length"] =  JSON.stringify(body).length.toString()

					fetch("http://localhost:" + this.port + data.route, {
						method:data.method,
						headers:{
							...headers,	
							"requestid":data.requestid,
							"Content-Type":"application/json;charset=utf-8"
						},
						body:JSON.stringify(body)
					})
			}

		})

	}
}

module.exports = {
	AresHost, 
	express,
	static,
	Try,
	Cache
}
