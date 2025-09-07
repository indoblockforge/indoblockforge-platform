import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import backend from '~backend/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Zap, Play, Search, Activity, Filter } from 'lucide-react';

export default function Events() {
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    contractAddress: '',
    eventName: '',
    networkId: '',
  });
  
  const [isSimulateOpen, setIsSimulateOpen] = useState(false);
  const [realtimeEvents, setRealtimeEvents] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  
  const [newEvent, setNewEvent] = useState({
    contractAddress: '',
    eventName: '',
    eventData: '',
    networkId: '',
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: events, isLoading } = useQuery({
    queryKey: ['events', filters],
    queryFn: () => backend.events.listEvents({
      page: filters.page,
      limit: filters.limit,
      contractAddress: filters.contractAddress || undefined,
      eventName: filters.eventName || undefined,
      networkId: filters.networkId ? parseInt(filters.networkId) : undefined,
    }),
  });

  const { data: contracts } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => backend.blockchain.listContracts(),
  });

  const { data: networks } = useQuery({
    queryKey: ['networks'],
    queryFn: () => backend.blockchain.listNetworks(),
  });

  const simulateEventMutation = useMutation({
    mutationFn: (data: typeof newEvent) => backend.events.simulateEvent({
      contractAddress: data.contractAddress,
      eventName: data.eventName,
      eventData: JSON.parse(data.eventData),
      networkId: parseInt(data.networkId),
    }),
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Event simulated successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setIsSimulateOpen(false);
      setNewEvent({
        contractAddress: '',
        eventName: '',
        eventData: '',
        networkId: '',
      });
    },
    onError: (error) => {
      console.error('Failed to simulate event:', error);
      toast({
        title: 'Error',
        description: 'Failed to simulate event',
        variant: 'destructive',
      });
    },
  });

  // WebSocket connection for real-time events
  useEffect(() => {
    const connectToEventStream = async () => {
      try {
        const stream = await backend.events.eventStream({});
        setIsConnected(true);
        
        for await (const event of stream) {
          setRealtimeEvents(prev => [event, ...prev.slice(0, 9)]); // Keep last 10 events
          
          toast({
            title: 'New Event',
            description: `${event.data.eventName} on ${event.data.contractAddress}`,
          });
        }
      } catch (error) {
        console.error('Event stream error:', error);
        setIsConnected(false);
      }
    };

    connectToEventStream();
  }, [toast]);

  const handleSimulateEvent = () => {
    if (!newEvent.contractAddress || !newEvent.eventName || !newEvent.eventData || !newEvent.networkId) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      JSON.parse(newEvent.eventData); // Validate JSON
      simulateEventMutation.mutate(newEvent);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Event data must be valid JSON',
        variant: 'destructive',
      });
    }
  };

  const handleSearch = () => {
    setFilters(prev => ({ ...prev, page: 1 }));
  };

  const formatEventData = (data: any) => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

  if (isLoading) {
    return <div>Loading events...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Blockchain Events</h1>
          <p className="text-muted-foreground">
            Monitor and analyze smart contract events in real-time.
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Badge variant={isConnected ? "default" : "secondary"}>
            {isConnected ? "Live" : "Disconnected"}
          </Badge>
          
          <Dialog open={isSimulateOpen} onOpenChange={setIsSimulateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Play className="h-4 w-4 mr-2" />
                Simulate Event
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Simulate Blockchain Event</DialogTitle>
                <DialogDescription>
                  Create a test event for development and testing purposes.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="contractAddress">Contract Address</Label>
                  <Input
                    id="contractAddress"
                    placeholder="0x..."
                    value={newEvent.contractAddress}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, contractAddress: e.target.value }))}
                  />
                </div>
                
                <div>
                  <Label htmlFor="eventName">Event Name</Label>
                  <Input
                    id="eventName"
                    placeholder="Transfer"
                    value={newEvent.eventName}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, eventName: e.target.value }))}
                  />
                </div>
                
                <div>
                  <Label htmlFor="networkId">Network</Label>
                  <Select 
                    value={newEvent.networkId} 
                    onValueChange={(value) => setNewEvent(prev => ({ ...prev, networkId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select network" />
                    </SelectTrigger>
                    <SelectContent>
                      {networks?.networks.map((network) => (
                        <SelectItem key={network.id} value={network.id.toString()}>
                          {network.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="eventData">Event Data (JSON)</Label>
                  <Textarea
                    id="eventData"
                    placeholder='{"from": "0x...", "to": "0x...", "value": "1000"}'
                    value={newEvent.eventData}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, eventData: e.target.value }))}
                    className="min-h-20"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  onClick={handleSimulateEvent}
                  disabled={simulateEventMutation.isPending}
                >
                  {simulateEventMutation.isPending ? 'Simulating...' : 'Simulate Event'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Real-time Events */}
      {realtimeEvents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <span>Live Events</span>
            </CardTitle>
            <CardDescription>Real-time blockchain events as they happen</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {realtimeEvents.map((event, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-accent rounded text-sm">
                  <div className="flex items-center space-x-2">
                    <Zap className="h-3 w-3 text-yellow-500" />
                    <span className="font-medium">{event.data.eventName}</span>
                    <span className="text-muted-foreground">
                      on {event.data.contractAddress?.slice(0, 8)}...
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Filters</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <Label htmlFor="contractAddress">Contract Address</Label>
              <Input
                id="contractAddress"
                placeholder="0x... or select"
                value={filters.contractAddress}
                onChange={(e) => setFilters(prev => ({ ...prev, contractAddress: e.target.value }))}
              />
            </div>
            
            <div>
              <Label htmlFor="eventName">Event Name</Label>
              <Input
                id="eventName"
                placeholder="Transfer, Approval..."
                value={filters.eventName}
                onChange={(e) => setFilters(prev => ({ ...prev, eventName: e.target.value }))}
              />
            </div>
            
            <div>
              <Label htmlFor="network">Network</Label>
              <Select 
                value={filters.networkId} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, networkId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All networks" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Networks</SelectItem>
                  {networks?.networks.map((network) => (
                    <SelectItem key={network.id} value={network.id.toString()}>
                      {network.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-end">
              <Button onClick={handleSearch} className="w-full">
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Events List */}
      <Card>
        <CardHeader>
          <CardTitle>Event History</CardTitle>
          <CardDescription>
            {events?.total || 0} events found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {events?.events.map((event) => (
              <div key={event.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">{event.eventName}</Badge>
                      <span className="text-sm text-muted-foreground">
                        Block #{event.blockNumber}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        Log Index: {event.logIndex}
                      </span>
                    </div>
                    
                    <div className="text-sm">
                      <span className="text-muted-foreground">Contract: </span>
                      <span className="font-mono">
                        {event.contractAddress.slice(0, 8)}...{event.contractAddress.slice(-6)}
                      </span>
                    </div>
                    
                    <div className="text-sm">
                      <span className="text-muted-foreground">Transaction: </span>
                      <span className="font-mono">
                        {event.transactionHash.slice(0, 10)}...{event.transactionHash.slice(-8)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-right text-sm text-muted-foreground">
                    <div>{new Date(event.createdAt).toLocaleDateString()}</div>
                    <div>{new Date(event.createdAt).toLocaleTimeString()}</div>
                  </div>
                </div>
                
                {event.eventData && Object.keys(event.eventData).length > 0 && (
                  <div className="mt-3">
                    <Label className="text-sm font-medium">Event Data:</Label>
                    <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto">
                      {formatEventData(event.eventData)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {events?.events.length === 0 && (
            <div className="text-center py-12">
              <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No events found</h3>
              <p className="text-muted-foreground mb-4">
                {filters.contractAddress || filters.eventName || filters.networkId 
                  ? "Try adjusting your filters to see more results."
                  : "Events will appear here when smart contracts emit them."
                }
              </p>
              <Button onClick={() => setIsSimulateOpen(true)}>
                <Play className="h-4 w-4 mr-2" />
                Simulate Test Event
              </Button>
            </div>
          )}
          
          {/* Pagination */}
          {events && events.total > filters.limit && (
            <div className="flex items-center justify-between pt-4">
              <div className="text-sm text-muted-foreground">
                Showing {((filters.page - 1) * filters.limit) + 1} to {Math.min(filters.page * filters.limit, events.total)} of {events.total} results
              </div>
              
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFilters(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                  disabled={filters.page <= 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFilters(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={filters.page * filters.limit >= events.total}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
