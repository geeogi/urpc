# urpc

a thin layer between HTML and RPC using webcomponents 

```.html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>RPC Web Components Test</title>
    <script type="module" src="urpc.js"></script>
  </head>
  <body>
    <u-url style="display: none">
      https://eth-mainnet.g.alchemy.com/v2/VjRG6l7jUiq9cJNzPDoLIw2lFz-pz_Ra
    </u-url>
    <u-directory style="display: none">
      <var>stETH:0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84</var>
      <var>unstETH:0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1</var>
      <var>balanceOf(address):0x70a08231</var>
    </u-directory>
    <!-- make RPC calls inline in HTML -->
    <p>stETH withdrawal queue: <u-c>$stETH.$balanceOf($unstETH).18</u-c></p>
  </body>
</html>
```
