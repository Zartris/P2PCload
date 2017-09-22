# Basic range in for loop
for value in {1..10}
do
    node app.js $((3003 + $value)) $1 3003 113 &
    sleep 1
done