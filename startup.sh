
# Instructions:
# 1. Execute 'node Kademlia/app.js' to get the first Kademlia peer running. Note the IP from the output. I.E. 192.168.0.104
# 2. Execute './startup.sh <ip-from-above>'. I.E. './startup.sh 192.168.0.104'. This will start some more Kademlia and some data storage nodes.
# 3. Call http://localhost:<a ds port>/api/ds/register/<sensor ip and port> through Postman or similar to register the sensor in the data storage network.

# Setup Kademlia network.
echo 'Starting Kademlia ...'
for value in {1..3}
do
    node Kademlia/app.js $((3005 + $value)) $1 3005 123 &
    sleep 1 
done


# Setup WoT data storage.
echo 'Starting WoT data storage'
for value in {1..4}
do
    node Kademlia/wot-ds.js $((2004 + $value)) &
    sleep 1 
done