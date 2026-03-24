import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));

console.log("Root methods:");
console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(aptos)).filter(name => name.toLowerCase().includes("event")));

if (aptos.queryIndexer) {
  console.log("queryIndexer exists");
}

if (aptos.getEvents) {
   console.log("getEvents exists");
}

function getAllMethods(obj) {
  let props = [];
  let currentObj = obj;
  do {
    props = props.concat(Object.getOwnPropertyNames(currentObj));
  } while ((currentObj = Object.getPrototypeOf(currentObj)) && currentObj !== Object.prototype);

  return props.sort().filter((e, i, arr) => {
     if (e!=arr[i+1] && typeof obj[e] == 'function') return true;
  });
}
console.log("All methods related to event:");
console.log(getAllMethods(aptos).filter(n => n.toLowerCase().includes("event")));
