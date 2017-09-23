/**
 * This file contains potentially outdated versions of the API. Should we decide to change anything, this SHOULD (emphasis on that badboy)
 * make it so old versions are available through the final doc.
 * Put very simply: If you change the API, please place the old version in here, update the current and change the version number
 * 
 * 
 * 
 * 
 * ...or not. I'm a code comment, not a cop.
 */

/**
 * 
 * @api {get} /api/kademlia/nodes/:id  Retrieves the k closest nodes to the specified ID.
 * @apiName FindNodes
 * @apiGroup Milestone1
 * @apiVersion 1.0.0
 * @apiDescription Corresponds to the Kademlia FIND_NODE as specified in the specification.

 * 
 * @apiHeader {String} node_address description
 * @apiHeader {String} node_port description
 * @apiHeader {String} node_id description
 * 
 * 
 * @apiHeaderExample {String} Request-Example (Headers):
   { node_address: 192.168.0.102, node_port: 3000, node_id: 101 }
 * 
 * @apiParam  {String} id The ID of the node you want the k closest nodes to.
 * @apiSuccess (200) {Triple[]} array the k closest nodes
 * 
 * @apiSuccessExample {Triple[]} Success-Response-Example:
    [{ ip = "192.168.0.102", port = 3000, id = 101 }, { ip = "192.168.0.102", port = 3001, id = 155  }]
 *
 */

 
/**
 * 
 * @api {post} /api/kademlia/ping Pings the node.
 * @apiName Ping
 * @apiGroup Milestone1
 * @apiVersion 1.0.0
 * @apiDescription Corresponds to the Kademlia PING as specified in the specification. Returns a PONG (status 200). Puts the requester in this node's bucket.
 * 
 * @apiHeader {String} node_address description
 * @apiHeader {String} node_port description
 * @apiHeader {String} node_id description
 * 
 * 
 * @apiHeaderExample {String} Request-Example (Headers):
   { node_address: 192.168.0.102, node_port: 3000, node_id: 101 }
 * 
 */