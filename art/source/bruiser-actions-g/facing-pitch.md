# Per-frame facing and pitch (bruiser hits and knockouts)

gates.py [--md OUT.md] : per-frame facing and pitch table for the bruiser's hit and knockout takes (cels/<clip>/NN.png, the
toned 192 px cels the packer reads), measured against each take's own frame 0 = the bruiser's idle cel 0 for that facing.

## hitEast (east, 5 frames, hit)

| f   | src    | ms  | height | w   | ratio | pred  | size pop | upright | face offset | skin px | head w | facing ok | foot dy      |
| --- | ------ | --- | ------ | --- | ----- | ----- | -------- | ------- | ----------- | ------- | ------ | --------- | ------------ |
| 0   | stance | 40  | 160    | 65  | 1.000 | 1.000 | 0.000    | True    | 0.0         | 261     | 1.0    | True      | 0            |
| 1   | 0      | 70  | 159    | 74  | 0.994 | 1.016 | 0.023    | True    | 0.024       | 250     | 1.03   | True      | 0            |
| 2   | 1      | 120 | 154    | 100 | 0.963 | 1.018 | 0.055    | True    | 0.062       | 224     | 1.11   | True      | 0 PITCH-FAIL |
| 3   | 2      | 80  | 153    | 95  | 0.956 | 1.007 | 0.051    | True    | 0.04        | 226     | 1.08   | True      | 0 PITCH-FAIL |
| 4   | stance | 90  | 160    | 65  | 1.000 | 1.000 | 0.000    | True    | 0.0         | 261     | 1.0    | True      | 0            |

## hitNorth (north, 5 frames, hit)

| f   | src    | ms  | height | w   | ratio | pred  | size pop | upright | face offset | skin px | head w | facing ok | foot dy |
| --- | ------ | --- | ------ | --- | ----- | ----- | -------- | ------- | ----------- | ------- | ------ | --------- | ------- |
| 0   | stance | 40  | 156    | 116 | 1.000 | 1.000 | 0.000    | True    | 0.0         | 131     | 1.0    | True      | 0       |
| 1   | 0      | 70  | 156    | 108 | 1.000 | 1.016 | 0.016    | True    | 0.013       | 130     | 0.88   | True      | 0       |
| 2   | 1      | 120 | 154    | 106 | 0.987 | 1.010 | 0.023    | True    | -0.12       | 185     | 1.17   | True      | 0       |
| 3   | 2      | 80  | 154    | 102 | 0.987 | 1.004 | 0.017    | True    | -0.067      | 164     | 1.1    | True      | 0       |
| 4   | stance | 90  | 156    | 116 | 1.000 | 1.000 | 0.000    | True    | 0.0         | 131     | 1.0    | True      | 0       |

## hitNorthEast (north-east, 5 frames, hit)

| f   | src    | ms  | height | w   | ratio | pred  | size pop | upright | face offset | skin px | head w | facing ok | foot dy      |
| --- | ------ | --- | ------ | --- | ----- | ----- | -------- | ------- | ----------- | ------- | ------ | --------- | ------------ |
| 0   | stance | 40  | 159    | 108 | 1.000 | 1.000 | 0.000    | True    | 0.0         | 158     | 1.0    | True      | 0            |
| 1   | 0      | 70  | 158    | 120 | 0.994 | 1.023 | 0.030    | True    | -0.019      | 147     | 1.05   | True      | 0            |
| 2   | 1      | 120 | 156    | 103 | 0.981 | 1.026 | 0.045    | True    | 0.011       | 151     | 1.09   | True      | 0 PITCH-FAIL |
| 3   | 2      | 80  | 154    | 105 | 0.969 | 1.010 | 0.042    | True    | 0.015       | 110     | 1.14   | True      | 0 PITCH-FAIL |
| 4   | stance | 90  | 159    | 108 | 1.000 | 1.000 | 0.000    | True    | 0.0         | 158     | 1.0    | True      | 0            |

## hitNorthWest (north-west, 5 frames, hit)

| f   | src    | ms  | height | w   | ratio | pred  | size pop | upright | face offset | skin px | head w | facing ok | foot dy                  |
| --- | ------ | --- | ------ | --- | ----- | ----- | -------- | ------- | ----------- | ------- | ------ | --------- | ------------------------ |
| 0   | stance | 40  | 159    | 85  | 1.000 | 1.000 | 0.000    | True    | 0.0         | 172     | 1.0    | True      | 0                        |
| 1   | 0      | 70  | 150    | 102 | 0.943 | 0.989 | 0.046    | True    | -0.054      | 139     | 1.26   | False     | 0 PITCH-FAIL FACING-FAIL |
| 2   | 1      | 120 | 147    | 110 | 0.925 | 0.968 | 0.043    | True    | -0.039      | 144     | 1.34   | False     | 0 PITCH-FAIL FACING-FAIL |
| 3   | 2      | 80  | 149    | 104 | 0.937 | 0.987 | 0.050    | True    | -0.042      | 153     | 1.32   | False     | 0 PITCH-FAIL FACING-FAIL |
| 4   | stance | 90  | 159    | 85  | 1.000 | 1.000 | 0.000    | True    | 0.0         | 172     | 1.0    | True      | 0                        |

## hitSouth (south, 5 frames, hit)

| f   | src    | ms  | height | w   | ratio | pred  | size pop | upright | face offset | skin px | head w | facing ok | foot dy |
| --- | ------ | --- | ------ | --- | ----- | ----- | -------- | ------- | ----------- | ------- | ------ | --------- | ------- |
| 0   | stance | 40  | 154    | 119 | 1.000 | 1.000 | 0.000    | True    | 0.0         | 220     | 1.0    | True      | 0       |
| 1   | 0      | 70  | 154    | 119 | 1.000 | 0.981 | 0.019    | True    | 0.042       | 199     | 1.02   | True      | 0       |
| 2   | 1      | 120 | 144    | 120 | 0.935 | 0.960 | 0.025    | True    | -0.057      | 309     | 1.19   | True      | 0       |
| 3   | 2      | 80  | 149    | 122 | 0.968 | 0.984 | 0.016    | True    | -0.012      | 269     | 1.18   | True      | 0       |
| 4   | stance | 90  | 154    | 119 | 1.000 | 1.000 | 0.000    | True    | 0.0         | 220     | 1.0    | True      | 0       |

## hitSouthEast (south-east, 5 frames, hit)

| f   | src    | ms  | height | w   | ratio | pred  | size pop | upright | face offset | skin px | head w | facing ok | foot dy                  |
| --- | ------ | --- | ------ | --- | ----- | ----- | -------- | ------- | ----------- | ------- | ------ | --------- | ------------------------ |
| 0   | stance | 40  | 160    | 91  | 1.000 | 1.000 | 0.000    | True    | 0.0         | 228     | 1.0    | True      | 0                        |
| 1   | 0      | 70  | 149    | 96  | 0.931 | 1.001 | 0.070    | True    | -0.012      | 437     | 1.29   | False     | 0 PITCH-FAIL FACING-FAIL |
| 2   | 1      | 120 | 147    | 102 | 0.919 | 0.995 | 0.076    | True    | -0.025      | 541     | 1.43   | False     | 0 PITCH-FAIL FACING-FAIL |
| 3   | 2      | 80  | 149    | 96  | 0.931 | 0.998 | 0.067    | True    | -0.015      | 472     | 1.36   | False     | 0 PITCH-FAIL FACING-FAIL |
| 4   | stance | 90  | 160    | 91  | 1.000 | 1.000 | 0.000    | True    | 0.0         | 228     | 1.0    | True      | 0                        |

## hitSouthWest (south-west, 5 frames, hit)

| f   | src    | ms  | height | w   | ratio | pred  | size pop    | upright | face offset | skin px | head w | facing ok   | foot dy |
| --- | ------ | --- | ------ | --- | ----- | ----- | ----------- | ------- | ----------- | ------- | ------ | ----------- | ------- |
| 0   | stance | 40  | 153    | 123 | 1.000 | 1.000 | 0.000       | True    | 0.0         | 302     | 1.0    | True        | 0       |
| 1   | 0      | 70  | 143    | 133 | 0.935 | 0.973 | 0.039 (n/a) | False   | 0.02        | 357     | 0.97   | True (info) | 0       |
| 2   | 1      | 120 | 143    | 141 | 0.935 | 0.930 | 0.005 (n/a) | False   | -0.076      | 199     | 0.88   | True (info) | 0       |
| 3   | 2      | 80  | 143    | 133 | 0.935 | 0.972 | 0.037 (n/a) | False   | 0.015       | 375     | 0.97   | True (info) | 0       |
| 4   | stance | 90  | 153    | 123 | 1.000 | 1.000 | 0.000       | True    | 0.0         | 302     | 1.0    | True        | 0       |

## hitWest (west, 5 frames, hit)

| f   | src    | ms  | height | w   | ratio | pred  | size pop | upright | face offset | skin px | head w | facing ok | foot dy |
| --- | ------ | --- | ------ | --- | ----- | ----- | -------- | ------- | ----------- | ------- | ------ | --------- | ------- |
| 0   | stance | 40  | 160    | 72  | 1.000 | 1.000 | 0.000    | True    | 0.0         | 245     | 1.0    | True      | 0       |
| 1   | 0      | 70  | 155    | 80  | 0.969 | 0.976 | 0.007    | True    | -0.045      | 216     | 1.08   | True      | 0       |
| 2   | 1      | 120 | 147    | 93  | 0.919 | 0.937 | 0.019    | True    | -0.019      | 252     | 1.18   | True      | 0       |
| 3   | 2      | 80  | 153    | 84  | 0.956 | 0.975 | 0.019    | True    | -0.031      | 231     | 1.16   | True      | 0       |
| 4   | stance | 90  | 160    | 72  | 1.000 | 1.000 | 0.000    | True    | 0.0         | 245     | 1.0    | True      | 0       |

## koNorthEast (north-east, 7 frames, ko)

| f   | src    | ms  | height | w   | ratio | pred  | size pop    | upright | face offset | skin px | head w | facing ok    | foot dy |
| --- | ------ | --- | ------ | --- | ----- | ----- | ----------- | ------- | ----------- | ------- | ------ | ------------ | ------- |
| 0   | stance | 40  | 159    | 108 | 1.000 | 1.000 | 0.000       | True    | 0.0         | 158     | 1.0    | True         | 0       |
| 1   | 0      | 80  | 137    | 131 | 0.862 | 0.804 | 0.058 (n/a) | False   | -0.041      | 226     | 0.98   | True (info)  | -18     |
| 2   | 1      | 60  | 110    | 139 | 0.692 | 0.606 | 0.085 (n/a) | False   | -0.122      | 244     | 1.0    | True (info)  | -32     |
| 3   | 2      | 50  | 105    | 152 | 0.660 | 0.433 | 0.228 (n/a) | False   | -0.228      | 241     | 1.16   | False (info) | -11     |
| 4   | 3      | 110 | 91     | 171 | 0.572 | 0.206 | 0.366 (n/a) | False   | -0.643      | 112     | 3.74   | False (info) | 1       |
| 5   | 4      | 90  | 98     | 188 | 0.616 | 0.169 | 0.448 (n/a) | False   | -           | 0       | 1.3    | False (info) | -2      |
| 6   | 5      | 400 | 80     | 190 | 0.503 | 0.180 | 0.324 (n/a) | False   | 0.043       | 2       | 2.26   | False (info) | -9      |

## koNorthWest (north-west, 7 frames, ko)

| f   | src    | ms  | height | w   | ratio | pred   | size pop    | upright | face offset | skin px | head w | facing ok    | foot dy        |
| --- | ------ | --- | ------ | --- | ----- | ------ | ----------- | ------- | ----------- | ------- | ------ | ------------ | -------------- |
| 0   | stance | 40  | 159    | 85  | 1.000 | 1.000  | 0.000       | True    | 0.0         | 172     | 1.0    | True         | 0              |
| 1   | 0      | 80  | 139    | 106 | 0.874 | 0.807  | 0.067       | True    | -0.059      | 125     | 1.09   | True         | -15 PITCH-FAIL |
| 2   | 1      | 60  | 113    | 132 | 0.711 | 0.600  | 0.110 (n/a) | False   | 0.143       | 210     | 1.28   | False (info) | -26            |
| 3   | 2      | 50  | 85     | 153 | 0.535 | 0.408  | 0.127 (n/a) | False   | 0.178       | 304     | 1.64   | False (info) | -27            |
| 4   | 3      | 110 | 83     | 168 | 0.522 | 0.126  | 0.396 (n/a) | False   | 0.586       | 150     | 3.23   | False (info) | -10            |
| 5   | 4      | 90  | 96     | 182 | 0.604 | -0.010 | 0.613 (n/a) | False   | -0.027      | 4       | 1.94   | False (info) | 0              |
| 6   | 5      | 400 | 90     | 184 | 0.566 | 0.037  | 0.529 (n/a) | False   | -0.147      | 6       | 3.23   | False (info) | 7              |

## koSouthEast (south-east, 7 frames, ko)

| f   | src    | ms  | height | w   | ratio | pred  | size pop    | upright | face offset | skin px | head w | facing ok    | foot dy      |
| --- | ------ | --- | ------ | --- | ----- | ----- | ----------- | ------- | ----------- | ------- | ------ | ------------ | ------------ |
| 0   | stance | 40  | 160    | 91  | 1.000 | 1.000 | 0.000       | True    | 0.0         | 228     | 1.0    | True         | 0            |
| 1   | 0      | 80  | 156    | 119 | 0.975 | 1.063 | 0.088       | True    | -0.028      | 222     | 1.02   | True         | 2 PITCH-FAIL |
| 2   | 1      | 60  | 148    | 139 | 0.925 | 0.995 | 0.070 (n/a) | False   | -0.043      | 229     | 0.95   | True (info)  | 6            |
| 3   | 2      | 50  | 125    | 147 | 0.781 | 0.807 | 0.026 (n/a) | False   | -0.073      | 218     | 0.96   | True (info)  | 6            |
| 4   | 3      | 110 | 73     | 156 | 0.456 | 0.468 | 0.012 (n/a) | False   | -0.276      | 430     | 2.61   | False (info) | 3            |
| 5   | 4      | 90  | 87     | 179 | 0.544 | 0.310 | 0.234 (n/a) | False   | -0.332      | 52      | 1.52   | False (info) | 13           |
| 6   | 5      | 400 | 85     | 176 | 0.531 | 0.334 | 0.198 (n/a) | False   | -           | 0       | 1.64   | False (info) | 0            |

## koSouthWest (south-west, 7 frames, ko)

| f   | src    | ms  | height | w   | ratio | pred  | size pop    | upright | face offset | skin px | head w | facing ok    | foot dy |
| --- | ------ | --- | ------ | --- | ----- | ----- | ----------- | ------- | ----------- | ------- | ------ | ------------ | ------- |
| 0   | stance | 40  | 153    | 123 | 1.000 | 1.000 | 0.000       | True    | 0.0         | 302     | 1.0    | True         | 0       |
| 1   | 0      | 80  | 155    | 137 | 1.013 | 1.035 | 0.022 (n/a) | False   | 0.005       | 315     | 0.91   | True (info)  | 5       |
| 2   | 1      | 60  | 149    | 142 | 0.974 | 0.994 | 0.020 (n/a) | False   | -0.114      | 173     | 0.65   | False (info) | 13      |
| 3   | 2      | 50  | 122    | 152 | 0.797 | 0.807 | 0.010 (n/a) | False   | -0.043      | 138     | 0.73   | False (info) | 13      |
| 4   | 3      | 110 | 91     | 157 | 0.595 | 0.426 | 0.169 (n/a) | False   | 0.528       | 2       | 2.14   | False (info) | -2      |
| 5   | 4      | 90  | 98     | 175 | 0.641 | 0.212 | 0.428 (n/a) | False   | -           | 0       | 0.29   | False (info) | 2       |
| 6   | 5      | 400 | 104    | 179 | 0.680 | 0.266 | 0.414 (n/a) | False   | -           | 0       | 0.23   | False (info) | 1       |
