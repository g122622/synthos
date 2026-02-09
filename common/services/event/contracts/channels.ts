enum EventNamespaces {
    Scheduler = "scheduler"
}

export enum EventChannels {
    DispatchTask = EventNamespaces.Scheduler + ":" + "dispatchTask",
    CompleteTask = EventNamespaces.Scheduler + ":" + "completeTask"
}
