const Web3 = require("web3");
const fs = require("fs/promises");
const fetch = require("node-fetch");

require("dotenv").config();

const web3 = new Web3(process.env.WEB3_RPC);

class VoteManager {

    voteContract = null;
    eventName = "";
    endBlock = 0;
    blockParentHash = "";
    voterDataFile = "./files/voter.json";

     constructor(deadlineBlock){

       (async()=>{

            this.voteContract = new web3.eth.Contract(JSON.parse(process.env.ABI),process.env.ADDRESS);
            this.eventName = await this.voteContract.methods.EVENT().call();

           // this.endBlock = await web3.eth.getBlockNumber();
            console.log(`----------------------------`);

            console.log(`Contract : ${this.eventName}`);

            await this.setEndBlock(deadlineBlock);
            await this.setBlockParentHash();

            console.log(`----------------------------`);

            await this.writeVoterData();
            await this.findWinner();

       })();

     }

     async setEndBlock(block){
        this.endBlock = block;
        console.log(`END BLOCK : ${block}`);
     }

     async setBlockParentHash(){
        this.blockParentHash = (await web3.eth.getBlock(this.endBlock)).parentHash;
        console.log(`BLOCK PARENT HASH : ${this.blockParentHash }`);
     }

     async findWinner(){
        try{

            let lastBlockHexNumber = String(this.blockParentHash).substring(String(this.blockParentHash).length-4 ,String(this.blockParentHash).length);

            const voter = JSON.parse(await fs.readFile(this.voterDataFile,`utf8`));

            let voterWithPoint = await  Promise.all(
                Array.from(voter).map(async (item,i)=>{

                    let lastNumber = (String(item._voter).substring(String(item._voter).length-4 ,String(item._voter).length));
                    let diff =  Math.abs(parseInt(lastBlockHexNumber,"16") - parseInt(lastNumber,"16"));

                    item.lastNumber = lastNumber;
                    item.diff = diff;

                    return item;
                })
            );

            voterWithPoint = voterWithPoint.sort((a,b)=>a.diff-b.diff);

            console.table(voterWithPoint);

        }catch(err){
            console.error(`find winner error-> `,err.stack);
        }
    }

     async writeVoterData(){
        try{
            const voter = await this.getVoter();

            if(!voter) throw new Error("empty data!");

            await fs.writeFile(this.voterDataFile,JSON.stringify(voter));
            
        }catch(error){
            console.log(`write voter error ->`,error.stack);
        }
     }

     async getVoter(){
        try{
                const latestBlock = this.endBlock;

                const param = [
                    {type : "address" , name : "_voter"},
                    {type : "uint256", name : "_nft"}
                ]
                
                // VoteNft (address _voter, uint256 _nft)
                const topics0 = "0xfea478f695169c9a8eeb5ce5ef54d69856526b09d933e0e78a7c80a62a2117b3";

                const uri = `https://api.bscscan.com/api
                                ?module=logs
                                &action=getLogs
                                &fromBlock=0
                                &toBlock=${latestBlock}
                                &topic0=${topics0}
                                &address=${process.env.ADDRESS}
                                &apikey=${process.env.BSC_API_KEY}`.replaceAll(" ","").replaceAll("\n","");

                const rawLogs = (await (await fetch(uri)).json()).result;
                
                return (await Promise.all(rawLogs.map(async(item,i)=>{
                        
                        let event = web3.eth.abi.decodeParameters(param, item.data);
                        
                        event._block = parseInt(item.blockNumber,16);
                        event._timestamp = parseInt(item.timeStamp,16);
                        event._transactionID = item.transactionHash;
                        delete event. __length__ ;
                        delete event[`0`];
                        delete event[`1`];

                        return JSON.parse(JSON.stringify(event));
                })));
        }catch(e){
            console.log("GET LOGS BY API ERROR-->",e.stack);
            return null;
        }
    }
}

module.exports = VoteManager;