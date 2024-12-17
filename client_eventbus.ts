/*
   A class implementing a pubsub pattern for sending custom events that diffrent parts of the application can subscribe and respond to 
   istead of having direct references between objects. Not currently used in the application, but can be useful to have around if/when things become too much spaghetti.  
*/
enum EventBusSubType {
    Once  = 0,
    Recur = 1
}

type EventBusSub = {
    eventName:string,
    subId:string,
    type:EventBusSubType,
    func:(args:any)=> void
}


interface IEventBus {
    on:(eventName:string,subId:string,func:(args:any)=> void) => void,
    once:(eventName:string,subId:string,func:(args:any)=> void) => void,
    off:(eventName:string,subId:string) => void,
    clearEvent:(eventName:string)=> void,
    clearAll:()=> void,
    emit:(eventName:string, args:any)=> void
}



class EventBus {
    private _subs: Map<string,Map<string,EventBusSub>>;
    
    constructor() {
      this._subs = new Map<string,Map<string,EventBusSub>>();
    }

    on(eventName:string,subId:string,func:(args:any)=> void) {
      this._subs.get(eventName)?.set(subId,{eventName:eventName,subId:subId,type:EventBusSubType.Recur,func:func});
    }

    once(eventName:string, subId:string, func:(args:any)=> void) {
      this._subs.get(eventName)?.set(subId,{eventName:eventName,subId:subId,type:EventBusSubType.Once,func:func});
    }

    off(eventName:string,subId:string) {
      this._subs.get(eventName)?.delete(subId);    
    }

    clearEvent(eventName:string) {
      this._subs.delete(eventName);
    }

    clearAll() {
      this._subs.clear();
    }

    emit(eventName:string, args:object) {
      this._subs.get(eventName)?.forEach(v=> v.func(args));
    }
}

const eventBus = new EventBus();
export { eventBus as default, EventBus };
