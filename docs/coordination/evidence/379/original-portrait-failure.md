# Original portrait WebGL failure

Actual run1 exit1/1563.58s. This was the unchanged30s Ready-click action deadline, not the30mcase cap. Original trace/video/full context remain retained locally; hashes and exact source/config identities are in provenance. The failure remains a failure.

# Test info

- Name: forest-road-polish.review.ts >> Forest Road native audit from Ba Dan to quarry gate
- Location: e2e/forest-road-polish.review.ts:27:1

# Error details

```
TimeoutError: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /I'm ready/i })
    - locator resolved to <button type="button" class="btn-primary btn-large">I'm ready</button>
  - attempting click action
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - performing click action
    - click action done
    - waiting for scheduled navigations to finish

```

# Page snapshot

```yaml
- generic [active] [ref=f1e1]:
    - generic [ref=f1e7]:
        - generic [ref=f1e8]:
            - generic [ref=f1e9]:
                - strong [ref=f1e10]: Ambush on the Forest Road
                - generic [ref=f1e11]: Round 1
            - group "View and help" [ref=f1e13]:
                - button "Recentre" [ref=f1e14] [cursor=pointer]
                - button "Acting unit" [ref=f1e19] [cursor=pointer]
                - button "Tip" [ref=f1e20] [cursor=pointer]
                - button "Log" [ref=f1e24] [cursor=pointer]
            - button "Pause" [ref=f1e28] [cursor=pointer]
        - generic [ref=f1e32]:
            - button "Focus Sura" [ref=f1e33] [cursor=pointer]:
                - generic [ref=f1e35]: Sura
            - button "Focus Bruiser" [ref=f1e36] [cursor=pointer]:
                - generic [ref=f1e38]: Bruiser
            - button "Focus Bruiser" [ref=f1e39] [cursor=pointer]:
                - generic [ref=f1e41]: Bruiser
            - button "Focus Bo" [ref=f1e42] [cursor=pointer]:
                - generic [ref=f1e44]: Bo
            - button "Focus Kaya" [ref=f1e45] [cursor=pointer]:
                - generic [ref=f1e47]: Kaya
        - generic "Battlefield" [ref=f1e49]
        - generic [ref=f1e50]:
            - generic [ref=f1e57]:
                - generic [ref=f1e58]:
                    - generic [ref=f1e59]:
                        - strong [ref=f1e60]: Sura
                        - generic [ref=f1e61]: Lorelai
                    - generic [ref=f1e62]: Level 1
                - generic [ref=f1e63]: 26 / 26
                - generic [ref=f1e66]:
                    - generic "4 action points" [ref=f1e67]
                    - generic [ref=f1e72]: Move 4
            - toolbar [ref=f1e73]:
                - generic [ref=f1e74]: 'Sura: choose an action, or end the turn.'
                - generic [ref=f1e76]:
                    - button "Move 4 left" [ref=f1e77] [cursor=pointer]:
                        - text: Move
                        - generic [ref=f1e82]: 4 left
                    - button "Water Whip 1 AP" [ref=f1e83] [cursor=pointer]:
                        - text: Water Whip
                        - generic [ref=f1e87]: 1 AP
                    - button "Shove 1 AP" [ref=f1e88] [cursor=pointer]:
                        - text: Shove
                        - generic [ref=f1e92]: 1 AP
                    - button "End turn 4 AP left" [ref=f1e93] [cursor=pointer]:
                        - text: End turn
                        - generic [ref=f1e97]: 4 AP left
    - status [ref=f1e98]: Hand the tablet to Lorelai.
```
