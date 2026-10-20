# Per-frame facing and pitch (thug hits and knockouts)

gates.py [--md OUT.md] : per-frame facing and pitch table for the thug's hit and knockout takes (cels/<clip>/NN.png, the
toned 192 px cels the packer reads), measured against each take's own frame 0 = the thug's idle cel 0 for that facing.

## hitEast (east, 5 frames, hit)

| f   | src    | ms  | height | w   | ratio | pred  | size pop | upright | face offset | skin px | head w | facing ok | foot dy      |
| --- | ------ | --- | ------ | --- | ----- | ----- | -------- | ------- | ----------- | ------- | ------ | --------- | ------------ |
| 0   | stance | 40  | 160    | 70  | 1.000 | 1.000 | 0.000    | True    | 0.0         | 80      | 1.0    | True      | 0            |
| 1   | 0      | 70  | 159    | 88  | 0.994 | 1.016 | 0.023    | True    | 0.0         | 74      | 1.0    | True      | 0            |
| 2   | 1      | 120 | 157    | 81  | 0.981 | 1.018 | 0.037    | True    | -0.023      | 82      | 1.02   | True      | 0 PITCH-FAIL |
| 3   | 2      | 80  | 157    | 87  | 0.981 | 1.007 | 0.026    | True    | -0.027      | 84      | 1.0    | True      | 0            |
| 4   | stance | 90  | 160    | 70  | 1.000 | 1.000 | 0.000    | True    | 0.0         | 80      | 1.0    | True      | 0            |

## hitNorth (north, 5 frames, hit)

| f   | src    | ms  | height | w   | ratio | pred  | size pop | upright | face offset | skin px | head w | facing ok | foot dy      |
| --- | ------ | --- | ------ | --- | ----- | ----- | -------- | ------- | ----------- | ------- | ------ | --------- | ------------ |
| 0   | stance | 40  | 155    | 93  | 1.000 | 1.000 | 0.000    | True    | 0.0         | 7       | 1.0    | True      | 0            |
| 1   | 0      | 70  | 154    | 84  | 0.994 | 1.015 | 0.022    | True    | -0.552      | 3       | 1.03   | True      | 0            |
| 2   | 1      | 120 | 148    | 88  | 0.955 | 1.010 | 0.055    | True    | -0.526      | 3       | 1.07   | True      | 0 PITCH-FAIL |
| 3   | 2      | 80  | 148    | 79  | 0.955 | 1.004 | 0.049    | True    | -0.077      | 8       | 1.07   | True      | 0 PITCH-FAIL |
| 4   | stance | 90  | 155    | 93  | 1.000 | 1.000 | 0.000    | True    | 0.0         | 7       | 1.0    | True      | 0            |

## hitNorthEast (north-east, 5 frames, hit)

| f   | src    | ms  | height | w   | ratio | pred  | size pop | upright | face offset | skin px | head w | facing ok | foot dy |
| --- | ------ | --- | ------ | --- | ----- | ----- | -------- | ------- | ----------- | ------- | ------ | --------- | ------- |
| 0   | stance | 40  | 159    | 88  | 1.000 | 1.000 | 0.000    | True    | 0.0         | 19      | 1.0    | True      | 0       |
| 1   | 0      | 70  | 159    | 92  | 1.000 | 1.023 | 0.023    | True    | 0.026       | 16      | 1.0    | True      | 0       |
| 2   | 1      | 120 | 159    | 79  | 1.000 | 1.026 | 0.026    | True    | 0.017       | 16      | 1.0    | True      | 0       |
| 3   | 2      | 80  | 159    | 82  | 1.000 | 1.010 | 0.010    | True    | 0.009       | 10      | 0.98   | True      | 0       |
| 4   | stance | 90  | 159    | 88  | 1.000 | 1.000 | 0.000    | True    | 0.0         | 19      | 1.0    | True      | 0       |

## hitNorthWest (north-west, 5 frames, hit)

| f   | src    | ms  | height | w   | ratio | pred  | size pop | upright | face offset | skin px | head w | facing ok | foot dy |
| --- | ------ | --- | ------ | --- | ----- | ----- | -------- | ------- | ----------- | ------- | ------ | --------- | ------- |
| 0   | stance | 40  | 159    | 55  | 1.000 | 1.000 | 0.000    | True    | 0.0         | 30      | 1.0    | True      | 0       |
| 1   | 0      | 70  | 156    | 63  | 0.981 | 0.989 | 0.008    | True    | -0.019      | 20      | 0.96   | True      | 0       |
| 2   | 1      | 120 | 152    | 72  | 0.956 | 0.968 | 0.012    | True    | -0.024      | 16      | 0.96   | True      | 0       |
| 3   | 2      | 80  | 156    | 64  | 0.981 | 0.987 | 0.006    | True    | 0.113       | 30      | 0.98   | True      | 0       |
| 4   | stance | 90  | 159    | 55  | 1.000 | 1.000 | 0.000    | True    | 0.0         | 30      | 1.0    | True      | 0       |

## hitSouth (south, 5 frames, hit)

| f   | src    | ms  | height | w   | ratio | pred  | size pop | upright | face offset | skin px | head w | facing ok | foot dy                  |
| --- | ------ | --- | ------ | --- | ----- | ----- | -------- | ------- | ----------- | ------- | ------ | --------- | ------------------------ |
| 0   | stance | 40  | 156    | 84  | 1.000 | 1.000 | 0.000    | True    | 0.0         | 112     | 1.0    | True      | 0                        |
| 1   | 0      | 70  | 150    | 78  | 0.962 | 0.982 | 0.021    | True    | 0.003       | 115     | 1.03   | True      | 0                        |
| 2   | 1      | 120 | 143    | 80  | 0.917 | 0.962 | 0.045    | True    | -0.044      | 98      | 1.38   | False     | 0 PITCH-FAIL FACING-FAIL |
| 3   | 2      | 80  | 150    | 82  | 0.962 | 0.985 | 0.023    | True    | -0.032      | 105     | 0.94   | True      | 0                        |
| 4   | stance | 90  | 156    | 84  | 1.000 | 1.000 | 0.000    | True    | 0.0         | 112     | 1.0    | True      | 0                        |

## hitSouthEast (south-east, 5 frames, hit)

| f   | src    | ms  | height | w   | ratio | pred  | size pop | upright | face offset | skin px | head w | facing ok | foot dy      |
| --- | ------ | --- | ------ | --- | ----- | ----- | -------- | ------- | ----------- | ------- | ------ | --------- | ------------ |
| 0   | stance | 40  | 158    | 52  | 1.000 | 1.000 | 0.000    | True    | 0.0         | 76      | 1.0    | True      | 0            |
| 1   | 0      | 70  | 153    | 60  | 0.968 | 1.001 | 0.033    | True    | -0.022      | 84      | 1.0    | True      | 0 PITCH-FAIL |
| 2   | 1      | 120 | 149    | 68  | 0.943 | 0.995 | 0.052    | True    | -0.02       | 95      | 1.18   | True      | 0 PITCH-FAIL |
| 3   | 2      | 80  | 149    | 63  | 0.943 | 0.998 | 0.055    | True    | -0.024      | 89      | 0.98   | True      | 0 PITCH-FAIL |
| 4   | stance | 90  | 158    | 52  | 1.000 | 1.000 | 0.000    | True    | 0.0         | 76      | 1.0    | True      | 0            |

## hitSouthWest (south-west, 5 frames, hit)

| f   | src    | ms  | height | w   | ratio | pred  | size pop | upright | face offset | skin px | head w | facing ok | foot dy      |
| --- | ------ | --- | ------ | --- | ----- | ----- | -------- | ------- | ----------- | ------- | ------ | --------- | ------------ |
| 0   | stance | 40  | 158    | 88  | 1.000 | 1.000 | 0.000    | True    | 0.0         | 88      | 1.0    | True      | 0            |
| 1   | 0      | 70  | 147    | 98  | 0.930 | 0.975 | 0.045    | True    | 0.032       | 85      | 0.98   | True      | 0 PITCH-FAIL |
| 2   | 1      | 120 | 141    | 107 | 0.892 | 0.935 | 0.043    | True    | 0.027       | 91      | 0.9    | True      | 0 PITCH-FAIL |
| 3   | 2      | 80  | 146    | 98  | 0.924 | 0.974 | 0.050    | True    | 0.016       | 93      | 0.95   | True      | 0 PITCH-FAIL |
| 4   | stance | 90  | 158    | 88  | 1.000 | 1.000 | 0.000    | True    | 0.0         | 88      | 1.0    | True      | 0            |

## hitWest (west, 5 frames, hit)

| f   | src    | ms  | height | w   | ratio | pred  | size pop | upright | face offset | skin px | head w | facing ok | foot dy      |
| --- | ------ | --- | ------ | --- | ----- | ----- | -------- | ------- | ----------- | ------- | ------ | --------- | ------------ |
| 0   | stance | 40  | 160    | 76  | 1.000 | 1.000 | 0.000    | True    | 0.0         | 73      | 1.0    | True      | 0            |
| 1   | 0      | 70  | 151    | 80  | 0.944 | 0.976 | 0.032    | True    | -0.002      | 59      | 0.94   | True      | 0 PITCH-FAIL |
| 2   | 1      | 120 | 144    | 91  | 0.900 | 0.937 | 0.037    | True    | 0.027       | 58      | 0.86   | True      | 0 PITCH-FAIL |
| 3   | 2      | 80  | 151    | 81  | 0.944 | 0.975 | 0.031    | True    | -0.02       | 60      | 0.98   | True      | 0 PITCH-FAIL |
| 4   | stance | 90  | 160    | 76  | 1.000 | 1.000 | 0.000    | True    | 0.0         | 73      | 1.0    | True      | 0            |

## koNorthEast (north-east, 7 frames, ko)

| f   | src    | ms  | height | w   | ratio | pred  | size pop    | upright | face offset | skin px | head w | facing ok    | foot dy                    |
| --- | ------ | --- | ------ | --- | ----- | ----- | ----------- | ------- | ----------- | ------- | ------ | ------------ | -------------------------- |
| 0   | stance | 40  | 159    | 88  | 1.000 | 1.000 | 0.000       | True    | 0.0         | 19      | 1.0    | True         | 0                          |
| 1   | 0      | 80  | 138    | 101 | 0.868 | 0.802 | 0.066       | True    | 0.031       | 7       | 0.95   | False        | -18 PITCH-FAIL FACING-FAIL |
| 2   | 1      | 60  | 114    | 109 | 0.717 | 0.604 | 0.113 (n/a) | False   | 0.031       | 12      | 0.98   | True (info)  | -31                        |
| 3   | 2      | 50  | 96     | 139 | 0.604 | 0.427 | 0.176 (n/a) | False   | 0.025       | 9       | 0.98   | True (info)  | -28                        |
| 4   | 3      | 110 | 86     | 163 | 0.541 | 0.197 | 0.344 (n/a) | False   | -0.208      | 19      | 3.79   | False (info) | -5                         |
| 5   | 4      | 90  | 86     | 182 | 0.541 | 0.165 | 0.376 (n/a) | False   | -0.058      | 96      | 1.19   | False (info) | -9                         |
| 6   | 5      | 400 | 68     | 182 | 0.428 | 0.174 | 0.253 (n/a) | False   | -0.293      | 88      | 3.26   | False (info) | -14                        |

## koNorthWest (north-west, 7 frames, ko)

| f   | src    | ms  | height | w   | ratio | pred   | size pop    | upright | face offset | skin px | head w | facing ok    | foot dy |
| --- | ------ | --- | ------ | --- | ----- | ------ | ----------- | ------- | ----------- | ------- | ------ | ------------ | ------- |
| 0   | stance | 40  | 159    | 55  | 1.000 | 1.000  | 0.000       | True    | 0.0         | 30      | 1.0    | True         | 0       |
| 1   | 0      | 80  | 127    | 88  | 0.799 | 0.802  | 0.003       | True    | 0.005       | 21      | 0.96   | True         | -25     |
| 2   | 1      | 60  | 96     | 122 | 0.604 | 0.595  | 0.008 (n/a) | False   | -0.024      | 16      | 0.87   | True (info)  | -36     |
| 3   | 2      | 50  | 80     | 144 | 0.503 | 0.405  | 0.098 (n/a) | False   | 0.49        | 42      | 2.18   | False (info) | -22     |
| 4   | 3      | 110 | 78     | 157 | 0.491 | 0.122  | 0.368 (n/a) | False   | 0.283       | 161     | 1.78   | False (info) | -11     |
| 5   | 4      | 90  | 82     | 170 | 0.516 | -0.019 | 0.535 (n/a) | False   | 0.088       | 199     | 1.93   | False (info) | -7      |
| 6   | 5      | 400 | 82     | 170 | 0.516 | 0.034  | 0.481 (n/a) | False   | 0.217       | 137     | 2.84   | False (info) | -2      |

## koSouthEast (south-east, 7 frames, ko)

| f   | src    | ms  | height | w   | ratio | pred  | size pop    | upright | face offset | skin px | head w | facing ok    | foot dy      |
| --- | ------ | --- | ------ | --- | ----- | ----- | ----------- | ------- | ----------- | ------- | ------ | ------------ | ------------ |
| 0   | stance | 40  | 158    | 52  | 1.000 | 1.000 | 0.000       | True    | 0.0         | 76      | 1.0    | True         | 0            |
| 1   | 0      | 80  | 157    | 88  | 0.994 | 1.059 | 0.066       | True    | -0.017      | 73      | 1.02   | True         | 6 PITCH-FAIL |
| 2   | 1      | 60  | 146    | 123 | 0.924 | 0.986 | 0.062       | True    | 0.057       | 95      | 0.98   | True         | 7 PITCH-FAIL |
| 3   | 2      | 50  | 115    | 149 | 0.728 | 0.778 | 0.050 (n/a) | False   | -0.074      | 101     | 1.2    | True (info)  | 5            |
| 4   | 3      | 110 | 65     | 152 | 0.411 | 0.425 | 0.013 (n/a) | False   | -0.199      | 285     | 3.5    | False (info) | 0            |
| 5   | 4      | 90  | 73     | 171 | 0.462 | 0.294 | 0.168 (n/a) | False   | -0.141      | 158     | 1.9    | False (info) | 4            |
| 6   | 5      | 400 | 65     | 172 | 0.411 | 0.309 | 0.103 (n/a) | False   | -0.187      | 184     | 2.4    | False (info) | -1           |

## koSouthWest (south-west, 7 frames, ko)

| f   | src    | ms  | height | w   | ratio | pred  | size pop    | upright | face offset | skin px | head w | facing ok    | foot dy       |
| --- | ------ | --- | ------ | --- | ----- | ----- | ----------- | ------- | ----------- | ------- | ------ | ------------ | ------------- |
| 0   | stance | 40  | 158    | 88  | 1.000 | 1.000 | 0.000       | True    | 0.0         | 88      | 1.0    | True         | 0             |
| 1   | 0      | 80  | 151    | 105 | 0.956 | 1.037 | 0.082       | True    | 0.034       | 100     | 0.88   | True         | 6 PITCH-FAIL  |
| 2   | 1      | 60  | 146    | 117 | 0.924 | 0.985 | 0.061       | True    | 0.011       | 105     | 0.95   | True         | 10 PITCH-FAIL |
| 3   | 2      | 50  | 122    | 139 | 0.772 | 0.801 | 0.029 (n/a) | False   | 0.055       | 112     | 1.0    | True (info)  | 11            |
| 4   | 3      | 110 | 65     | 154 | 0.411 | 0.446 | 0.035 (n/a) | False   | 0.275       | 308     | 3.68   | False (info) | -2            |
| 5   | 4      | 90  | 64     | 163 | 0.405 | 0.246 | 0.159 (n/a) | False   | -0.009      | 209     | 3.78   | False (info) | 4             |
| 6   | 5      | 400 | 67     | 164 | 0.424 | 0.304 | 0.120 (n/a) | False   | -0.062      | 71      | 3.6    | False (info) | 4             |
